window.Webflow && window.Webflow.push(function() {
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
    // Set first item's Lottie to end frame (open/X state)
    var firstIcon = firstDropdown.querySelector('.faq-icon');
    if (firstIcon && window.lottie) {
      var animations = lottie.getRegisteredAnimations();
      var firstAnim = animations.find(function(anim) {
        return anim.wrapper === firstIcon;
      });
      if (firstAnim) {
        firstAnim.goToAndStop(firstAnim.totalFrames - 1, true);
      }
    }
  }, 500);
});
