(() => {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.intersectionRatio < 0.35) continue;
      entry.target.classList.add('arrived');
      observer.unobserve(entry.target);
    }
  }, {threshold: 0.35, rootMargin: '0px 0px -6% 0px'});

  document.querySelectorAll('section > h2, .project-video')
    .forEach(item => observer.observe(item));
})();
