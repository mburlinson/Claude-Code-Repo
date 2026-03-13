document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var firstToggle = document.querySelector('.faq-p .faq.w-dropdown-toggle');
    var firstList = document.querySelector('.faq-p .faq-body-3.w-dropdown-list');
    if (firstToggle && firstList) {
      firstToggle.classList.add('w--open');
      firstList.classList.add('w--open');
    }
  }, 500);
});
