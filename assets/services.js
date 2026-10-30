// Scroll reveal (IntersectionObserver) and single-open service index.
(() => {
  const items = document.querySelectorAll(".item");

  items.forEach((item) => {
    const head = item.querySelector(".item-head");
    head.addEventListener("click", () => {
      const open = !item.classList.contains("open");
      items.forEach((other) => {
        const isTarget = other === item && open;
        other.classList.toggle("open", isTarget);
        other.querySelector(".item-head").setAttribute("aria-expanded", String(isTarget));
      });
    });
  });

  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }
})();
