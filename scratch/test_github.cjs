const token = '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';
const repo = 'abasdipto/elab-work-analytics';

async function testGithub() {
  const url = `https://api.github.com/repos/${repo}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'eLab-Diagnostic-Script'
      }
    });
    console.log("GitHub API Status:", res.status);
    const data = await res.json();
    if (res.ok) {
      console.log("Success! Repo is accessible.");
      console.log("Repo Name:", data.full_name);
      console.log("Permissions:", JSON.stringify(data.permissions, null, 2));
    } else {
      console.log("Failed! Message:", data.message);
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testGithub();
