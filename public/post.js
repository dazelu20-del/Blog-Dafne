(function () {
  const config = window.__POST__;
  if (!config) return;

  const csrfToken = config.csrfToken;
  const postId = config.id;

  function readCsrfFromCookie() {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : csrfToken;
  }

  const commentForm = document.getElementById("comment-form");
  if (!commentForm) return;

  commentForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!config.loggedIn) {
      window.location.href = "/login?next=/post/" + postId;
      return;
    }

    const bodyField = document.getElementById("comment-body");
    const errorEl = document.getElementById("comment-error");
    errorEl.hidden = true;

    const response = await fetch("/api/post/" + postId + "/comment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": readCsrfFromCookie(),
      },
      body: JSON.stringify({ body: bodyField.value }),
    });
    const data = await response.json();
    if (!data.ok) {
      errorEl.textContent = data.error || "Could not post comment.";
      errorEl.hidden = false;
      return;
    }

    const list = document.getElementById("comment-list");
    if (list) {
      const item = document.createElement("li");
      item.className = "comment";
      const meta = document.createElement("p");
      meta.className = "comment-meta";
      const strong = document.createElement("strong");
      strong.textContent = data.comment.author;
      meta.appendChild(strong);
      meta.appendChild(
        document.createTextNode(" · " + data.comment.created_at)
      );
      const body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = data.comment.body;
      item.appendChild(meta);
      item.appendChild(body);
      list.appendChild(item);
    } else {
      const section = document.querySelector(".comments-section");
      const newList = document.createElement("ul");
      newList.id = "comment-list";
      newList.className = "comment-list";
      const item = document.createElement("li");
      item.className = "comment";
      const meta = document.createElement("p");
      meta.className = "comment-meta";
      const strong = document.createElement("strong");
      strong.textContent = data.comment.author;
      meta.appendChild(strong);
      meta.appendChild(
        document.createTextNode(" · " + data.comment.created_at)
      );
      const body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = data.comment.body;
      item.appendChild(meta);
      item.appendChild(body);
      newList.appendChild(item);
      const empty = section?.querySelector(".empty-state");
      if (empty) empty.remove();
      commentForm.before(newList);
    }
    bodyField.value = "";
  });
})();
