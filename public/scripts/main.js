(function () {
  /* Handle user delete */
  var deleteUserButtons = document.getElementsByClassName("delete-user-btn");

  var deleteUser = async function (e) {
    e.preventDefault();
    var attribute = this.getAttribute("data-id");
    if (confirm("Are you sure you wish to delete this user?")) {
      const response = await fetch("/delete_user", {
        method: "post",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: attribute,
        }),
      });
      if (response.ok) {
        this.parentElement.parentElement.remove();
      } else {
        alert("Error while deleting user!");
      }
    }
  };

  Array.from(deleteUserButtons).forEach(function (element) {
    element.addEventListener("click", deleteUser);
  });

  /* Handle domain delete */
  var deleteDomainButtons =
    document.getElementsByClassName("delete-domain-btn");

  var deleteDomain = async function (e) {
    e.preventDefault();
    var attribute = this.getAttribute("data-id");
    if (confirm("Are you sure you wish to delete this domain?")) {
      const response = await fetch("/delete_domain", {
        method: "post",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain_id: attribute,
        }),
      });
      if (response.ok) {
        this.parentElement.parentElement.remove();
      } else {
        alert("Error while deleting domain!");
      }
    }
  };

  Array.from(deleteDomainButtons).forEach(function (element) {
    element.addEventListener("click", deleteDomain);
  });

  /* Filter domains on job history page */
  if (document.getElementById("domain_select")) {
    document
      .getElementById("domain_select")
      .addEventListener("change", function () {
        var tableId = "domain-" + this.value;

        if (this.value != "") {
          var allTables = document.querySelectorAll("div.domain");
          Array.prototype.slice.call(allTables).forEach(function (value) {
            value.classList.add("hide");
          });

          const el = document.querySelector("#" + tableId);
          if (el.classList.contains("hide")) {
            el.classList.remove("hide");
          }
        } else {
          var allTables = document.querySelectorAll("div.domain");
          Array.prototype.slice.call(allTables).forEach(function (value) {
            value.classList.remove("hide");
          });
        }
      });
  }

  /* Get statistics live updates */
  if (document.getElementById("statistics")) {
    var job_name = document.getElementById("job_name");
    var keyword_name = document.getElementById("keyword_name");
    var keywords_pending = document.getElementById("keywords_pending");
    var jobs_pending = document.getElementById("jobs_pending");
    var keywords_ready = document.getElementById("keywords_ready");
    var jobs_ready = document.getElementById("jobs_ready");
    var all_time_keywords = document.getElementById("all_time_keywords");
    var all_time_jobs = document.getElementById("all_time_jobs");

    var callAjax = function () {
      fetch(location.protocol + "//" + location.host + "/statistics")
        .then((response) => response.json())
        .then((data) => {
          let stats = data.data;
          job_name.innerText = stats.job_name ? stats.job_name : "none";
          keyword_name.innerText = stats.keyword_name
            ? stats.keyword_name
            : "none";
          keywords_pending.innerText = stats.keywords_pending;
          jobs_pending.innerText = stats.jobs_pending;
          keywords_ready.innerText = stats.keywords_ready;
          jobs_ready.innerText = stats.jobs_ready;
          all_time_keywords.innerText = stats.all_time_keywords;
          all_time_jobs.innerText = stats.all_time_jobs;
        })
        .catch((error) => {
          console.log(error);
          throw new Error("There was an error while refreshing the stats");
        });
    };

    callAjax();

    setInterval(function () {
      callAjax();
    }, 30000);
  }
})();
