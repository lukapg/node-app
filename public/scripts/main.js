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
})();
