document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var firstDropdown = document.querySelector('.faq-p.w-dropdown');
    if (!firstDropdown) return;
    var toggle = firstDropdown.querySelector('.faq.w-dropdown-toggle');
    var list = firstDropdown.querySelector('.faq-body-3.w-dropdown-list');
    if (toggle && list) {
      toggle.classList.add('w--open');
      list.classList.add('w--open');
      firstDropdown.style.height = 'auto';
    }
  }, 500);
});
