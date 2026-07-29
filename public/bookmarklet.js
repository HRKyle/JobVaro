// =============================================================================
// JobVaro Bookmarklet — "Save to JobVaro"
// =============================================================================
// Drag the following link to your bookmarks bar, or copy-paste into a bookmark:
//
//   javascript:(function(){var title=document.title.replace(/\s*[-|]\s*.+$/,'').trim();var company='';var m=document.querySelector('meta[property="og:site_name"]');if(m) company=m.getAttribute('content');if(!company) company=location.hostname.replace('www.','').replace('.com','').replace('.io','');company=company.charAt(0).toUpperCase()+company.slice(1);var url=location.href;location.href='https://b705ed824dd0f2d1ccaf36868664c133.ctonew.app/track?url='+encodeURIComponent(url)+'&title='+encodeURIComponent(title)+'&company='+encodeURIComponent(company);})();
//
// How it works:
//   1. Extracts the job title from the page title (strips site suffixes
//      like " | LinkedIn" or " - Indeed").
//   2. Tries to get the company name from the og:site_name meta tag.
//   3. Falls back to a cleaned-up hostname.
//   4. Redirects to your JobVaro tracker with the data pre-filled.
// =============================================================================

(function () {
  // ── 1. Extract title ──────────────────────────────────────────────────────
  // Strip common site suffixes: " | CompanyName", " - SiteName"
  var title = document.title.replace(/\s*[-|]\s*.+$/, "").trim();

  // ── 2. Extract company ────────────────────────────────────────────────────
  var company = "";
  var m = document.querySelector('meta[property="og:site_name"]');
  if (m) {
    company = m.getAttribute("content");
  }
  if (!company) {
    // Fallback: guess from hostname
    company = location.hostname
      .replace("www.", "")
      .replace(".com", "")
      .replace(".io", "");
    // Capitalize first letter
    company = company.charAt(0).toUpperCase() + company.slice(1);
  }

  // ── 3. Get page URL ───────────────────────────────────────────────────────
  var url = location.href;

  // ── 4. Redirect to JobVaro tracker ────────────────────────────────────────
  location.href =
    "https://b705ed824dd0f2d1ccaf36868664c133.ctonew.app/track" +
    "?url=" +
    encodeURIComponent(url) +
    "&title=" +
    encodeURIComponent(title) +
    "&company=" +
    encodeURIComponent(company);
})();
