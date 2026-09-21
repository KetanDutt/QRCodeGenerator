/**
 * Theme bootstrap.
 *
 * Loaded synchronously in <head> so the correct colour scheme is applied
 * before the first paint (no flash of the wrong theme). Kept as an external
 * file rather than an inline script so the page works under a strict
 * Content-Security-Policy without 'unsafe-inline'.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'qrgen.theme';
  var root = document.documentElement;

  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (error) {
      return 'light';
    }
  }

  function storedTheme() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (error) {
      return null;
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }

  apply(storedTheme() || systemTheme());

  // Follow the OS setting until the user picks a theme explicitly.
  try {
    var query = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if (!storedTheme()) apply(systemTheme());
    };
    if (query.addEventListener) query.addEventListener('change', onChange);
    else if (query.addListener) query.addListener(onChange);
  } catch (error) {
    /* matchMedia unavailable - nothing to follow */
  }

  window.QRGen = window.QRGen || {};
  window.QRGen.theme = {
    STORAGE_KEY: STORAGE_KEY,
    get: function () {
      return root.getAttribute('data-theme') || 'light';
    },
    set: function (theme) {
      apply(theme);
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch (error) {
        /* private mode / storage disabled - theme still applies for this page */
      }
    },
    toggle: function () {
      var next = this.get() === 'dark' ? 'light' : 'dark';
      this.set(next);
      return next;
    }
  };
}());
