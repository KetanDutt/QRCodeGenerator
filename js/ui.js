/**
 * Minimal UI primitives (browser only): toasts and modal dialogs built on
 * the native <dialog> element. Replaces the SweetAlert2 dependency so the
 * app follows its own light/dark theme and ships zero third-party UI code.
 */
(function (root) {
  'use strict';

  const ICONS = {
    info: 'info',
    success: 'check-circle',
    warning: 'alert-triangle',
    error: 'alert-circle',
    question: 'help-circle'
  };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else if (attrs[key] != null) node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  /** Inline SVG <use> reference to a symbol from the sprite in index.html. */
  function icon(name, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-' + name);
    svg.appendChild(use);
    return svg;
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */

  let toastContainer = null;

  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.getElementById('toasts') ||
        document.body.appendChild(el('div', { id: 'toasts', className: 'toasts' }));
      toastContainer.setAttribute('role', 'status');
      toastContainer.setAttribute('aria-live', 'polite');
    }
    return toastContainer;
  }

  /**
   * Show a transient notification.
   * @param {string} message
   * @param {{ type?: 'info'|'success'|'warning'|'error', duration?: number }} [options]
   */
  function toast(message, options) {
    options = options || {};
    const type = ICONS[options.type] ? options.type : 'info';
    const duration = options.duration == null ? (type === 'error' ? 7000 : 4000) : options.duration;

    const close = el('button', { type: 'button', className: 'toast-close', 'aria-label': 'Dismiss notification' }, [icon('x')]);
    const node = el('div', { className: 'toast toast-' + type }, [
      icon(ICONS[type], 'toast-icon'),
      el('div', { className: 'toast-message', text: message }),
      close
    ]);

    let timer = null;
    function dismiss() {
      if (timer) clearTimeout(timer);
      node.classList.add('toast-leaving');
      setTimeout(function () { node.remove(); }, 200);
    }
    close.addEventListener('click', dismiss);
    if (duration > 0) timer = setTimeout(dismiss, duration);

    const container = getToastContainer();
    container.appendChild(node);
    // Keep the stack short.
    while (container.children.length > 5) container.firstElementChild.remove();
    return dismiss;
  }

  /* ------------------------------------------------------------------ */
  /* Message dialog (alert / confirm)                                    */
  /* ------------------------------------------------------------------ */

  let messageDialog = null;
  let pendingMessage = null;

  function getMessageDialog() {
    if (messageDialog) return messageDialog;
    messageDialog = el('dialog', { className: 'dialog dialog-message', 'aria-labelledby': 'messageDialogTitle' });
    document.body.appendChild(messageDialog);
    messageDialog.addEventListener('close', function () {
      // A close event queued for a superseded dialog arrives after the next
      // one has been opened; ignore it in that case.
      if (messageDialog.open) return;
      const pending = pendingMessage;
      pendingMessage = null;
      if (pending) pending(messageDialog.returnValue || 'cancel');
    });
    return messageDialog;
  }

  function supportsDialog(dialog) {
    return typeof dialog.showModal === 'function';
  }

  /**
   * Render and open the shared message dialog.
   * @returns {Promise<string>} the dialog return value ("confirm" / "cancel")
   */
  function openMessage(config) {
    const dialog = getMessageDialog();
    if (!supportsDialog(dialog)) {
      // Very old browser: degrade to native dialogs.
      const text = (config.title ? config.title + '\n\n' : '') + (config.message || '');
      return Promise.resolve(config.cancelText ? (window.confirm(text) ? 'confirm' : 'cancel') : (window.alert(text), 'confirm'));
    }

    if (pendingMessage) {
      // Opening a new message while one is showing cancels the previous one.
      const previous = pendingMessage;
      pendingMessage = null;
      previous('cancel');
    }
    if (dialog.open) dialog.close('cancel');

    dialog.textContent = '';
    const type = ICONS[config.type] ? config.type : 'info';

    const body = [el('p', { className: 'dialog-text', text: config.message || '' })];
    if (config.details && config.details.length) {
      body.push(el('ul', { className: 'dialog-details' }, config.details.map(function (item) {
        return el('li', { text: item });
      })));
    }

    const buttons = [];
    if (config.cancelText) {
      buttons.push(el('button', { type: 'button', className: 'btn btn-ghost', value: 'cancel', text: config.cancelText }));
    }
    const confirmButton = el('button', {
      type: 'button',
      className: 'btn ' + (config.danger ? 'btn-danger' : 'btn-primary'),
      value: 'confirm',
      text: config.confirmText || 'OK'
    });
    buttons.push(confirmButton);

    dialog.appendChild(el('div', { className: 'dialog-body' }, [
      el('div', { className: 'dialog-icon dialog-icon-' + type }, [icon(ICONS[type])]),
      el('div', { className: 'dialog-content' }, [
        el('h2', { className: 'dialog-title', id: 'messageDialogTitle', text: config.title || '' })
      ].concat(body)),
      el('div', { className: 'dialog-actions' }, buttons)
    ]));

    return new Promise(function (resolve) {
      buttons.forEach(function (button) {
        button.addEventListener('click', function () { dialog.close(button.value); });
      });
      pendingMessage = resolve;
      dialog.returnValue = '';
      dialog.showModal();
      confirmButton.focus();
    });
  }

  /**
   * @param {{ title?: string, message?: string, type?: string, details?: string[], confirmText?: string }} config
   * @returns {Promise<void>}
   */
  function alert(config) {
    return openMessage(Object.assign({}, config, { cancelText: null })).then(function () { return undefined; });
  }

  /**
   * @param {{ title?: string, message?: string, type?: string, details?: string[], confirmText?: string, cancelText?: string, danger?: boolean }} config
   * @returns {Promise<boolean>}
   */
  function confirm(config) {
    return openMessage(Object.assign({ type: 'question', cancelText: 'Cancel', confirmText: 'Confirm' }, config))
      .then(function (value) { return value === 'confirm'; });
  }

  /* ------------------------------------------------------------------ */
  /* Generic dialogs                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Open an existing <dialog> as a modal, closing on backdrop click.
   * @param {HTMLDialogElement} dialog
   */
  function openDialog(dialog) {
    if (!supportsDialog(dialog)) {
      dialog.setAttribute('open', '');
      return;
    }
    if (!dialog.dataset.backdropBound) {
      dialog.dataset.backdropBound = 'true';
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) dialog.close();
      });
    }
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    if (supportsDialog(dialog)) {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  root.QRGen = root.QRGen || {};
  root.QRGen.ui = {
    toast: toast,
    alert: alert,
    confirm: confirm,
    openDialog: openDialog,
    closeDialog: closeDialog,
    icon: icon,
    el: el
  };
}(typeof self !== 'undefined' ? self : this));
