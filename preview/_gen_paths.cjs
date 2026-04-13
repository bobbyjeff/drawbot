const fs = require("fs");
const path = require("path");
const svgPath = path.join(__dirname, "../images/public/blog_og_nvidia_04.svg");
const x = fs.readFileSync(svgPath, "utf8");
const paths = [...x.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
fs.writeFileSync(
  path.join(__dirname, "nvidia-paths-embed.js"),
  "// Generated from images/public/blog_og_nvidia_04.svg — do not edit by hand\nvar PATH_DS = " +
    JSON.stringify(paths) +
    ";\n"
);
