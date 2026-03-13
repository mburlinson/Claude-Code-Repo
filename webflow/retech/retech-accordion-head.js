// Observe DOM for Lottie elements and disable autoplay before Webflow initializes them
new MutationObserver(function(mutations, observer) {
  mutations.forEach(function(m) {
    m.addedNodes.forEach(function(node) {
      if (node.nodeType !== 1) return;
      var lotties = node.querySelectorAll
        ? node.querySelectorAll('[data-animation-type="lottie"]')
        : [];
      lotties.forEach(function(el) {
        el.setAttribute('data-autoplay', '0');
      });
      if (node.getAttribute && node.getAttribute('data-animation-type') === 'lottie') {
        node.setAttribute('data-autoplay', '0');
      }
    });
  });
}).observe(document.documentElement, { childList: true, subtree: true });
