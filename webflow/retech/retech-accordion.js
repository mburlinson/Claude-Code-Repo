document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var firstItem = document.querySelector('.faq-p');
    if (firstItem) {
      firstItem.click();
    }
  }, 500);
});
