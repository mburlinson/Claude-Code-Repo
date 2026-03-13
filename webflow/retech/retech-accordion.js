window.Webflow && window.Webflow.push(function() {
  setTimeout(function() {
    var dropdowns = document.querySelectorAll('.faq-p.w-dropdown');
    if (!dropdowns.length) return;

    var animations = window.lottie ? lottie.getRegisteredAnimations() : [];
    var closedHeight = '4.5rem';

    function getAnim(dropdown) {
      var icon = dropdown.querySelector('.faq-icon');
      if (!icon || !animations.length) return null;
      return animations.find(function(a) { return a.wrapper === icon; });
    }

    function closeDropdown(dropdown) {
      var toggle = dropdown.querySelector('.faq.w-dropdown-toggle');
      var list = dropdown.querySelector('.faq-body-3.w-dropdown-list');
      if (toggle) toggle.classList.remove('w--open');
      if (list) list.classList.remove('w--open');
      dropdown.style.height = closedHeight;
      var anim = getAnim(dropdown);
      if (anim) anim.goToAndStop(0, true);
    }

    function openDropdown(dropdown) {
      var toggle = dropdown.querySelector('.faq.w-dropdown-toggle');
      var list = dropdown.querySelector('.faq-body-3.w-dropdown-list');
      if (toggle) toggle.classList.add('w--open');
      if (list) list.classList.add('w--open');
      dropdown.style.height = 'auto';
      var anim = getAnim(dropdown);
      if (anim) anim.goToAndStop(anim.totalFrames - 1, true);
    }

    // Close all, then open the first
    dropdowns.forEach(function(dd) { closeDropdown(dd); });
    openDropdown(dropdowns[0]);

    // When any toggle is clicked, close all others
    dropdowns.forEach(function(dropdown) {
      var toggle = dropdown.querySelector('.faq.w-dropdown-toggle');
      if (!toggle) return;
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = toggle.classList.contains('w--open');
        // Close all
        dropdowns.forEach(function(dd) { closeDropdown(dd); });
        // If it wasn't open, open it
        if (!isOpen) {
          openDropdown(dropdown);
        }
      });
    });
  }, 500);
});
