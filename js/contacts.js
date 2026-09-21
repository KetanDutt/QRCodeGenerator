/**
 * Column detection, contact record building and validation.
 *
 * The CSV headers people export from HR tools and form builders vary a lot
 * ("Employee Contact Number", "Company Employee Contact Number", "Phone", ...)
 * so instead of hard-coding column positions, every logical field has a list
 * of accepted header aliases. Detection is done in two passes:
 *
 *   1. exact match on the normalised header text (highest priority alias wins)
 *   2. keyword match for anything still unmapped ("Mobile No." -> phone)
 *
 * Each CSV column can be claimed by at most one field. The user can always
 * override the detected mapping in the UI.
 *
 * Exposed as `QRGen.contacts` in the browser and as a CommonJS module in Node.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./utils'));
  } else {
    root.QRGen = root.QRGen || {};
    root.QRGen.contacts = factory(root.QRGen.utils);
  }
}(typeof self !== 'undefined' ? self : this, function (utils) {
  'use strict';

  /**
   * Logical fields, in detection priority order (specific fields first so
   * that e.g. "Emergency Contact Number" is claimed before the generic
   * "contact" keyword of the phone field gets a chance).
   */
  const FIELDS = [
    {
      key: 'firstName', label: 'First Name', required: 'name',
      aliases: ['first name', 'firstname', 'given name', 'givenname', 'fname', 'first'],
      keywords: ['first name', 'given']
    },
    {
      key: 'lastName', label: 'Last Name', required: 'name',
      aliases: ['last name', 'lastname', 'surname', 'family name', 'familyname', 'lname', 'last'],
      keywords: ['last name', 'surname', 'family']
    },
    {
      key: 'fullName', label: 'Full Name', required: 'name',
      aliases: ['full name', 'fullname', 'employee name', 'name'],
      keywords: ['full name']
    },
    {
      key: 'employeeId', label: 'Employee ID',
      aliases: ['employee id', 'employeeid', 'emp id', 'empid', 'employee code', 'employee number',
        'employee no', 'staff id', 'staff number', 'emp code', 'id'],
      keywords: ['employee id', 'emp id', 'employee code', 'staff id']
    },
    {
      key: 'emergencyPhone', label: 'Emergency Contact Number',
      aliases: ['emergency contact number', 'emergency contact no', 'emergency contact', 'emergency number',
        'emergency phone', 'emergency mobile', 'emergency'],
      keywords: ['emergency']
    },
    {
      key: 'phone', label: 'Employee Contact Number',
      aliases: ['company employee contact number', 'employee contact number', 'employee contact no',
        'employee contact', 'employee phone', 'employee mobile', 'contact number', 'contact no',
        'work phone', 'office phone', 'mobile number', 'mobile no', 'phone number', 'phone no',
        'mobile', 'phone', 'telephone', 'tel', 'contact'],
      keywords: ['phone', 'mobile', 'contact', 'tel']
    },
    {
      key: 'email', label: 'Official Email ID',
      aliases: ['official email id', 'official email', 'official e mail', 'work email', 'company email',
        'email address', 'e mail address', 'email id', 'e mail id', 'e mail', 'email', 'mail'],
      keywords: ['email', 'e mail']
    },
    {
      key: 'designation', label: 'Designation',
      aliases: ['designation', 'job title', 'jobtitle', 'title', 'position', 'role', 'post'],
      keywords: ['designation', 'title', 'position', 'role']
    },
    {
      key: 'company', label: 'Company',
      aliases: ['company', 'company name', 'organization', 'organisation', 'org', 'employer', 'firm'],
      keywords: ['company', 'organi']
    },
    {
      key: 'bloodGroup', label: 'Blood Group',
      aliases: ['blood group', 'bloodgroup', 'blood type', 'bloodtype'],
      keywords: ['blood']
    }
  ];

  const FIELD_KEYS = FIELDS.map(function (field) { return field.key; });

  /**
   * Normalise a header for comparison: lower-case, drop parenthesised notes
   * ("Emergency Contact Number (should not be ...)"), keep only letters/digits.
   * @param {unknown} header
   * @returns {string}
   */
  function normalizeHeader(header) {
    return String(header == null ? '' : header)
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /**
   * Detect which CSV column feeds which logical field.
   * @param {string[]} headers
   * @returns {Record<string, number>} field key -> column index (-1 when not found)
   */
  function detectMapping(headers) {
    const normalized = (headers || []).map(normalizeHeader);
    const claimed = new Set();
    const mapping = {};
    FIELD_KEYS.forEach(function (key) { mapping[key] = -1; });

    // Pass 1: exact alias match, honouring alias priority.
    FIELDS.forEach(function (field) {
      for (let a = 0; a < field.aliases.length && mapping[field.key] === -1; a++) {
        const index = normalized.indexOf(field.aliases[a]);
        if (index !== -1 && !claimed.has(index)) {
          mapping[field.key] = index;
          claimed.add(index);
        }
      }
    });

    // Pass 2: keyword containment for anything still unmapped.
    FIELDS.forEach(function (field) {
      if (mapping[field.key] !== -1) return;
      for (let i = 0; i < normalized.length && mapping[field.key] === -1; i++) {
        if (claimed.has(i) || normalized[i] === '') continue;
        const matches = field.keywords.some(function (keyword) {
          return normalized[i].indexOf(keyword) !== -1;
        });
        if (matches) {
          mapping[field.key] = i;
          claimed.add(i);
        }
      }
    });

    return mapping;
  }

  /**
   * @param {Record<string, number>} mapping
   * @returns {boolean} true when at least one name column is mapped
   */
  function hasNameColumn(mapping) {
    return mapping.firstName !== -1 || mapping.lastName !== -1 || mapping.fullName !== -1;
  }

  /** Split "Ada King Lovelace" into { firstName: "Ada King", lastName: "Lovelace" }. */
  function splitFullName(fullName) {
    const parts = utils.collapseWhitespace(fullName).split(' ');
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
  }

  /**
   * Turn parsed CSV rows into validated contact records.
   *
   * @param {{ headers: string[], rows: string[][], lines?: number[] }} parsed  output of csv.parse()
   * @param {Record<string, number>} mapping                                    output of detectMapping()
   * @param {{ defaultCompany?: string }} [options]
   * @returns {{
   *   contacts: object[],
   *   issues: { row: number, level: 'error'|'warning', message: string }[],
   *   skipped: number
   * }}
   */
  function buildContacts(parsed, mapping, options) {
    options = options || {};
    const defaultCompany = utils.collapseWhitespace(options.defaultCompany);
    const contacts = [];
    const issues = [];
    let skipped = 0;

    const seenEmails = new Map();
    const seenPhones = new Map();

    function cell(row, key) {
      const index = mapping[key];
      if (index == null || index < 0 || index >= row.length) return '';
      return utils.collapseWhitespace(row[index]);
    }

    parsed.rows.forEach(function (row, i) {
      const rowNumber = parsed.lines && parsed.lines[i] ? parsed.lines[i] : i + 2;
      const warnings = [];

      let firstName = cell(row, 'firstName');
      let lastName = cell(row, 'lastName');
      const fullName = cell(row, 'fullName');

      if (!firstName && !lastName && fullName) {
        const split = splitFullName(fullName);
        firstName = split.firstName;
        lastName = split.lastName;
      }
      const displayName = utils.collapseWhitespace(firstName + ' ' + lastName) || fullName;

      if (!displayName) {
        skipped += 1;
        issues.push({ row: rowNumber, level: 'error', message: 'Row ' + rowNumber + ' skipped: no name found.' });
        return;
      }

      const phone = utils.normalizePhone(cell(row, 'phone'));
      const emergencyPhone = utils.normalizePhone(cell(row, 'emergencyPhone'));
      const email = cell(row, 'email');
      const company = cell(row, 'company') || defaultCompany;

      const contact = {
        row: rowNumber,
        firstName: firstName,
        lastName: lastName,
        displayName: displayName,
        designation: cell(row, 'designation'),
        company: company,
        phone: phone,
        emergencyPhone: emergencyPhone,
        email: email,
        employeeId: cell(row, 'employeeId'),
        bloodGroup: cell(row, 'bloodGroup'),
        warnings: warnings
      };

      if (!phone && !email) {
        warnings.push('No phone number or e-mail address.');
      }
      if (email && !utils.isValidEmail(email)) {
        warnings.push('E-mail address "' + email + '" does not look valid.');
      }
      if (phone && emergencyPhone && utils.phoneDigits(phone) === utils.phoneDigits(emergencyPhone)) {
        warnings.push('Emergency contact number is the same as the employee contact number.');
      }
      if (email) {
        const emailKey = email.toLowerCase();
        if (seenEmails.has(emailKey)) {
          warnings.push('Duplicate e-mail address (also in row ' + seenEmails.get(emailKey) + ').');
        } else {
          seenEmails.set(emailKey, rowNumber);
        }
      }
      if (phone) {
        const phoneKey = utils.phoneDigits(phone);
        if (phoneKey && seenPhones.has(phoneKey)) {
          warnings.push('Duplicate contact number (also in row ' + seenPhones.get(phoneKey) + ').');
        } else if (phoneKey) {
          seenPhones.set(phoneKey, rowNumber);
        }
      }

      warnings.forEach(function (message) {
        issues.push({ row: rowNumber, level: 'warning', message: 'Row ' + rowNumber + ' (' + displayName + '): ' + message });
      });

      contacts.push(contact);
    });

    return { contacts: contacts, issues: issues, skipped: skipped };
  }

  /**
   * Build unique, file-system safe base names for a list of contacts
   * (e.g. "Ada_Lovelace-E1001").
   * @param {object[]} contacts
   * @returns {string[]}
   */
  function fileBaseNames(contacts) {
    const names = contacts.map(function (contact) {
      const name = utils.sanitizeFilename(contact.displayName, 'employee', 60);
      const id = contact.employeeId ? utils.sanitizeFilename(contact.employeeId, '', 20) : '';
      return id ? name + '-' + id : name;
    });
    return utils.makeUniqueNames(names);
  }

  return {
    FIELDS: FIELDS,
    FIELD_KEYS: FIELD_KEYS,
    normalizeHeader: normalizeHeader,
    detectMapping: detectMapping,
    hasNameColumn: hasNameColumn,
    buildContacts: buildContacts,
    fileBaseNames: fileBaseNames
  };
}));
