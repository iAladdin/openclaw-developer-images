import boxen from "boxen";
import * as colors from "yoctocolors";

import {
  DEFAULT_IMAGE_BASE_TAG,
  DEFAULT_IMAGE_CHANNEL,
  PROFILE_SUMMARIES,
  SUPPORTED_PROFILES
} from "./constants.mjs";

function pad(value, width) {
  return value.padEnd(width, " ");
}

function ansiEnabled(explicit) {
  if (typeof explicit === "boolean") {
    return explicit;
  }

  return Boolean(process.stdout?.isTTY && process.env.NO_COLOR !== "1");
}

function paint(enabled, fn, value) {
  return enabled ? fn(value) : value;
}

function formatRows(rows, enabled) {
  const width = Math.max(...rows.map(([label]) => label.length));

  return rows.map(([label, description]) => {
    const name = paint(enabled, colors.cyanBright, pad(label, width));
    return `  ${name}  ${description}`;
  });
}

function renderSection({ title, rows, enabled }) {
  const heading = paint(enabled, colors.bold, title);
  return [heading, ...rows].join("\n");
}

export function renderHelp({
  defaultInstance,
  defaultProfile,
  defaultImage,
  managerHome,
  instancesRoot,
  styled
}) {
  const enabled = ansiEnabled(styled);
  const commands = formatRows(
    [
      ["ocdev up", "Create or refresh an instance, pick free ports, and wait for Docker health."],
      ["ocdev down", "Stop an instance. Add `--volumes` to remove its persistent Docker volumes too."],
      ["ocdev logs", "Tail gateway logs, or target another service with `--service`."],
      ["ocdev token", "Print the Control UI token stored in the managed `.env` file."],
      ["ocdev approve", "Approve the first browser pairing request after the login page appears."],
      ["ocdev exec", "Run an arbitrary command inside a managed container."],
      ["ocdev claw", "Shortcut for `docker exec ... openclaw ...` against the gateway container."],
      ["ocdev help", "Show command reference, profiles, defaults, and copy-paste examples."]
    ],
    enabled
  );
  const profiles = formatRows(
    [...SUPPORTED_PROFILES]
      .sort((a, b) => {
        if (a === defaultProfile) {
          return -1;
        }
        if (b === defaultProfile) {
          return 1;
        }
        return a.localeCompare(b);
      })
      .map((profile) => [profile, PROFILE_SUMMARIES.get(profile) || "Published developer image profile."]),
    enabled
  );
  const examples = formatRows(
    [
      ["npx openclaw-dev up --name my-project", "One-shot launch without a global install."],
      ["ocdev up --name api --profile go-python", "Launch a named instance with a different published profile."],
      ["ocdev approve my-project --latest", "Approve the newest pending browser pairing request."],
      ["ocdev claw my-project -- devices list", "Call the OpenClaw CLI inside the running gateway container."],
      ["OPENCLAW_DEV_HOME=~/.openclaw-dev-work ocdev up", "Override the manager root for a separate sandbox."]
    ],
    enabled
  );
  const defaults = formatRows(
    [
      ["Default instance", defaultInstance],
      ["Default profile", defaultProfile],
      ["Default image", defaultImage],
      ["Image channel", `${DEFAULT_IMAGE_CHANNEL} (${DEFAULT_IMAGE_BASE_TAG})`],
      ["Manager home", managerHome],
      ["Instances root", instancesRoot]
    ],
    enabled
  );

  const hero = [
    paint(enabled, colors.bold, "ocdev - OpenClaw developer instance launcher"),
    "Launch isolated OpenClaw developer instances from published Docker images.",
    "",
    paint(enabled, colors.dim, "Quick start"),
    "  npx openclaw-dev up --name my-project"
  ].join("\n");

  const sections = [
    enabled
      ? boxen(hero, {
          borderStyle: "round",
          borderColor: "cyan",
          padding: { top: 0, bottom: 0, left: 1, right: 1 }
        })
      : hero,
    renderSection({
      title: "Commands",
      rows: commands,
      enabled
    }),
    renderSection({
      title: "Profiles",
      rows: profiles,
      enabled
    }),
    renderSection({
      title: "Examples",
      rows: examples,
      enabled
    }),
    renderSection({
      title: "Defaults",
      rows: defaults,
      enabled
    }),
    renderSection({
      title: "Managed files",
      rows: [
        "  `.env` managed keys are refreshed on each `ocdev up`; extra keys are preserved.",
        "  `docker-compose.instance.yml` and `README.md` refresh only when you pass `--refresh-template`."
      ],
      enabled
    })
  ];

  return sections.join("\n\n");
}
