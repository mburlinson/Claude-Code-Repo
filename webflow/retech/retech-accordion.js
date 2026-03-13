window.Webflow && window.Webflow.push(function() {
  setTimeout(function() {
    var dropdowns = document.querySelectorAll('.faq-p.w-dropdown');
    if (!dropdowns.length) return;

    // Stop all FAQ Lotties and reset to frame 0 (closed/plus state)
    if (window.lottie) {
      var animations = lottie.getRegisteredAnimations();
      dropdowns.forEach(function(dropdown) {
        var icon = dropdown.querySelector('.faq-icon');
        if (!icon) return;
        var anim = animations.find(function(a) {
          return a.wrapper === icon;
        });
        if (anim) {
          anim.goToAndStop(0, true);
        }
      });
    }

    // Open the first dropdown
    var firstDropdown = dropdowns[0];
    var toggle = firstDropdown.querySelector('.faq.w-dropdown-toggle');
    var list = firstDropdown.querySelector('.faq-body-3.w-dropdown-list');
    if (toggle && list) {
      toggle.classList.add('w--open');
      list.classList.add('w--open');
      firstDropdown.style.height = 'auto';
    }

    // Set first item's Lottie to end frame (open/X state)
    if (window.lottie) {
      var firstIcon = firstDropdown.querySelector('.faq-icon');
      var animations = lottie.getRegisteredAnimations();
      var firstAnim = animations.find(function(a) {
        return a.wrapper === firstIcon;
      });
      if (firstAnim) {
        firstAnim.goToAndStop(firstAnim.totalFrames - 1, true);
      }
    }
  }, 500);
});
