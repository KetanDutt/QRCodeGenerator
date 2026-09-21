/**
 * vCard 3.0 (RFC 2426) builder.
 *
 * Produces deterministic output (no REV/UID timestamps) so that the same
 * contact always yields the same QR code, and escapes text values exactly as
 * the specification requires (backslash, newline, comma, semicolon).
 *
 * Exposed as `QRGen.vcard` in the browser and as a CommonJS module in Node.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QRGen = root.QRGen || {};
    root.QRGen.vcard = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CRLF = '\r\n';

  /** Default set of optional fields that are written into the card. */
  const DEFAULT_INCLUDE = Object.freeze({
    emergencyPhone: true,
    employeeId: true,
    bloodGroup: true
  });

  /**
   * Escape a text value for use inside a vCard property (RFC 2426 §2.4.2).
   * @param {unknown} value
   * @returns {string}
   */
  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  /**
   * Phone numbers are not "text" values, but they must never contain a line
   * break or a property separator.
   * @param {unknown} value
   * @returns {string}
   */
  function cleanPhone(value) {
    return String(value == null ? '' : value).replace(/[\r\n;,]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  /**
   * Build a single vCard.
   *
   * @param {{
   *   firstName?: string, lastName?: string, displayName?: string,
   *   company?: string, designation?: string,
   *   phone?: string, emergencyPhone?: string, email?: string,
   *   employeeId?: string, bloodGroup?: string
   * }} contact
   * @param {{ include?: Partial<typeof DEFAULT_INCLUDE>, defaultCompany?: string }} [options]
   * @returns {string} vCard text terminated by CRLF
   */
  function build(contact, options) {
    contact = contact || {};
    options = options || {};
    const include = Object.assign({}, DEFAULT_INCLUDE, options.include || {});

    const firstName = clean(contact.firstName);
    const lastName = clean(contact.lastName);
    const displayName = clean(contact.displayName) || clean(firstName + ' ' + lastName);
    const company = clean(contact.company) || clean(options.defaultCompany);
    const designation = clean(contact.designation);
    const phone = cleanPhone(contact.phone);
    const emergencyPhone = include.emergencyPhone ? cleanPhone(contact.emergencyPhone) : '';
    const email = clean(contact.email);
    const employeeId = include.employeeId ? clean(contact.employeeId) : '';
    const bloodGroup = include.bloodGroup ? clean(contact.bloodGroup) : '';

    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

    // N is mandatory in vCard 3.0: Family;Given;Additional;Prefix;Suffix
    lines.push('N:' + escapeText(lastName) + ';' + escapeText(firstName) + ';;;');
    // FN is mandatory as well.
    lines.push('FN:' + escapeText(displayName));

    if (company) lines.push('ORG:' + escapeText(company));
    if (designation) lines.push('TITLE:' + escapeText(designation));
    if (phone) lines.push('TEL;TYPE=WORK,VOICE:' + phone);

    if (emergencyPhone) {
      // A grouped property with an X-ABLabel is the widely supported way to
      // give a phone number a custom label ("Emergency Contact") on both iOS
      // and Android, so it is never mistaken for the employee's own number.
      lines.push('item1.TEL;TYPE=VOICE:' + emergencyPhone);
      lines.push('item1.X-ABLabel:Emergency Contact');
    }

    if (email) lines.push('EMAIL;TYPE=INTERNET,WORK:' + escapeText(email));

    const note = [];
    if (employeeId) note.push('Employee ID: ' + employeeId);
    if (bloodGroup) note.push('Blood Group: ' + bloodGroup);
    if (emergencyPhone) note.push('Emergency Contact: ' + emergencyPhone);
    if (note.length) lines.push('NOTE:' + escapeText(note.join('\n')));

    lines.push('END:VCARD');
    return lines.join(CRLF) + CRLF;
  }

  /**
   * Concatenate many vCards into one .vcf document.
   * @param {object[]} contacts
   * @param {object} [options] see build()
   * @returns {string}
   */
  function buildMany(contacts, options) {
    return (contacts || []).map(function (contact) { return build(contact, options); }).join('');
  }

  return {
    build: build,
    buildMany: buildMany,
    escapeText: escapeText,
    DEFAULT_INCLUDE: DEFAULT_INCLUDE
  };
}));
