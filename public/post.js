(function () {
  const config = window.__POST__;
  if (!config) return;

  const csrfToken = config.csrfToken;
  const postId = config.id;

  function readCsrfFromCookie() {
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : csrfToken;
  }

  async function react(kind) {
    if (!config.loggedIn) {
      window.location.href = "/login?next=/post/" + postId;
      return;
    }
    const response = await fetch("/api/post/" + postId + "/react", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": readCsrfFromCookie(),
      },
      body: JSON.stringify({ kind: kind }),
    });
    const data = await response.json();
    if (!data.ok) return;

    document.getElementById("like-count").textContent = String(data.counts.like);
    document.getElementById("dislike-count").textContent = String(
      data.counts.dislike
    );

    const likeBtn = document.getElementById("like-btn");
    const dislikeBtn = document.getElementById("dislike-btn");
    likeBtn.classList.toggle("active", data.reaction === "like");
    dislikeBtn.classList.toggle("active", data.reaction === "dislike");
  }

  document.getElementById("like-btn")?.addEventListener("click", function () {
    react("like");
  });
  document.getElementById("dislike-btn")?.addEventListener("click", function () {
    react("dislike");
  });

  const commentForm = document.getElementById("comment-form");
  if (commentForm) {
    commentForm.addEventListener("submit", async function (event) {
      event.preventDefault();
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
      }
      bodyField.value = "";
    });
  }
})();
