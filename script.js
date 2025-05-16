function normalizeText(text) {
      return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .replace(/Ñ/g, "N")
        .toLowerCase();
    }

    function filterApps(category) {
      const apps = document.querySelectorAll(".app");
      apps.forEach((app) => {
        if (category === "todo") {
          app.classList.remove("hidden");
        } else {
          if (app.classList.contains(category)) {
            app.classList.remove("hidden");
          } else {
            app.classList.add("hidden");
          }
        }
      });
    }

    document.getElementById("searchBar").addEventListener("input", function () {
      const searchTerm = normalizeText(this.value);
      const apps = document.querySelectorAll(".app");
      apps.forEach((app) => {
        const title = normalizeText(app.querySelector(".app-title").textContent);
        if (title.includes(searchTerm)) {
          app.classList.remove("hidden");
        } else {
          app.classList.add("hidden");
        }
      });
    });

    const darkModeToggle = document.getElementById("darkModeToggle");

    function updateIcon() {
      if (document.body.classList.contains("dark-mode")) {
        darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
      } else {
        darkModeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
      }
    }

    darkModeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      updateIcon();
    });

    updateIcon();