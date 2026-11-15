/**
 * Page templates: ready-made pages people can start from when they add a page.
 * Each is a normal page (groups of links and notes) in the SyncPads file format,
 * so creating one goes through the same path as importing a file.
 * Notes are written as prompts the person fills in, and give their AI context.
 */
import type { FilePage } from "./syncpads-file";

export type PageTemplate = {
  id: string;
  name: string;
  /** One line for the gallery. */
  description: string;
  emoji: string;
  page: Omit<FilePage, "name">;
};

const link = (url: string, title: string) => ({ type: "link" as const, url, title });
const note = (title: string, body: string) => ({ type: "note" as const, title, body });

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "work",
    name: "Work hub",
    emoji: "💼",
    description: "Email, calendar, chat and docs in one place, with a note for today's priorities.",
    page: {
      layout: "auto",
      groups: [
        {
          name: "Every day",
          layout: "tiles",
          items: [
            link("https://mail.google.com/", "Gmail"),
            link("https://calendar.google.com/", "Calendar"),
            link("https://app.slack.com/", "Slack"),
            link("https://zoom.us/", "Zoom"),
          ],
        },
        {
          name: "Docs and files",
          layout: "list",
          items: [
            link("https://drive.google.com/", "Google Drive"),
            link("https://www.notion.so/", "Notion"),
            link("https://www.office.com/", "Microsoft 365"),
          ],
        },
        {
          name: "Focus",
          layout: "list",
          items: [
            note(
              "Today's priorities",
              "<ol><li>The one thing that matters most today</li><li>Second priority</li><li>If there's time</li></ol>",
            ),
          ],
        },
      ],
    },
  },
  {
    id: "project",
    name: "Client project",
    emoji: "📁",
    description: "Brief, files and meeting notes for one project, plus decisions your AI can rely on.",
    page: {
      layout: "3",
      groups: [
        {
          name: "Brief",
          layout: "list",
          items: [
            note(
              "Project at a glance",
              "<p><strong>Client:</strong> </p><p><strong>Goal:</strong> </p><p><strong>Deadline:</strong> </p><p><strong>Main contact:</strong> </p>",
            ),
          ],
        },
        {
          name: "Files and links",
          layout: "list",
          items: [link("https://drive.google.com/", "Shared folder"), link("https://www.figma.com/", "Designs")],
        },
        {
          name: "Decisions",
          layout: "list",
          items: [
            note(
              "What we've decided",
              "<p>Write decisions here as you make them, so you (and your AI) never have to dig through old threads.</p><ul><li></li></ul>",
            ),
            note("Open questions", "<ul><li></li></ul>"),
          ],
        },
      ],
    },
  },
  {
    id: "developer",
    name: "Developer",
    emoji: "💻",
    description: "Code, docs and the everyday tools for building and shipping.",
    page: {
      layout: "3",
      groups: [
        {
          name: "Code",
          layout: "tiles",
          items: [
            link("https://github.com/", "GitHub"),
            link("https://vercel.com/dashboard", "Vercel"),
            link("https://hub.docker.com/", "Docker Hub"),
            link("https://www.npmjs.com/", "npm"),
          ],
        },
        {
          name: "Docs",
          layout: "list",
          items: [
            link("https://developer.mozilla.org/", "MDN Web Docs"),
            link("https://devdocs.io/", "DevDocs"),
            link("https://caniuse.com/", "Can I use"),
            link("https://stackoverflow.com/", "Stack Overflow"),
          ],
        },
        {
          name: "Tools",
          layout: "list",
          items: [
            link("https://regex101.com/", "regex101"),
            link("https://jwt.io/", "JWT debugger"),
            link("https://crontab.guru/", "Crontab guru"),
            link("https://excalidraw.com/", "Excalidraw"),
          ],
        },
      ],
    },
  },
  {
    id: "design",
    name: "Designer",
    emoji: "🎨",
    description: "Design tools, inspiration, fonts, colors and free images.",
    page: {
      layout: "3",
      groups: [
        {
          name: "Design",
          layout: "tiles",
          items: [link("https://www.figma.com/", "Figma"), link("https://www.canva.com/", "Canva"), link("https://www.framer.com/", "Framer")],
        },
        {
          name: "Inspiration",
          layout: "list",
          items: [
            link("https://dribbble.com/", "Dribbble"),
            link("https://www.behance.net/", "Behance"),
            link("https://mobbin.com/", "Mobbin"),
            link("https://www.awwwards.com/", "Awwwards"),
          ],
        },
        {
          name: "Resources",
          layout: "list",
          items: [
            link("https://fonts.google.com/", "Google Fonts"),
            link("https://coolors.co/", "Coolors"),
            link("https://unsplash.com/", "Unsplash"),
            link("https://fonts.google.com/icons", "Material Symbols"),
          ],
        },
      ],
    },
  },
  {
    id: "marketing",
    name: "Marketing",
    emoji: "📣",
    description: "Analytics, social, email and content tools, with a content plan to fill in.",
    page: {
      layout: "auto",
      groups: [
        {
          name: "Numbers",
          layout: "list",
          items: [
            link("https://analytics.google.com/", "Google Analytics"),
            link("https://search.google.com/search-console", "Search Console"),
            link("https://clarity.microsoft.com/", "Microsoft Clarity"),
          ],
        },
        {
          name: "Channels",
          layout: "tiles",
          items: [
            link("https://business.facebook.com/", "Meta Business Suite"),
            link("https://www.linkedin.com/", "LinkedIn"),
            link("https://mailchimp.com/", "Mailchimp"),
            link("https://www.canva.com/", "Canva"),
          ],
        },
        {
          name: "Plan",
          layout: "list",
          items: [
            note(
              "Content plan",
              "<p><strong>This week:</strong></p><ul><li></li></ul><p><strong>Ideas:</strong></p><ul><li></li></ul>",
            ),
          ],
        },
      ],
    },
  },
  {
    id: "study",
    name: "Study and research",
    emoji: "📚",
    description: "Search papers, take notes and keep track of assignments.",
    page: {
      layout: "3",
      groups: [
        {
          name: "Research",
          layout: "list",
          items: [
            link("https://scholar.google.com/", "Google Scholar"),
            link("https://arxiv.org/", "arXiv"),
            link("https://www.wikipedia.org/", "Wikipedia"),
            link("https://www.zotero.org/", "Zotero"),
          ],
        },
        {
          name: "Write and learn",
          layout: "list",
          items: [
            link("https://docs.google.com/", "Google Docs"),
            link("https://www.overleaf.com/", "Overleaf"),
            link("https://www.khanacademy.org/", "Khan Academy"),
          ],
        },
        {
          name: "To do",
          layout: "list",
          items: [note("Assignments", "<ul><li><strong>Due:</strong> </li></ul>")],
        },
      ],
    },
  },
  {
    id: "ai",
    name: "AI toolkit",
    emoji: "✨",
    description: "The AI assistants and tools you use, side by side.",
    page: {
      layout: "auto",
      groups: [
        {
          name: "Assistants",
          layout: "tiles",
          items: [
            link("https://claude.ai/", "Claude"),
            link("https://chatgpt.com/", "ChatGPT"),
            link("https://gemini.google.com/", "Gemini"),
            link("https://www.perplexity.ai/", "Perplexity"),
          ],
        },
        {
          name: "Build with AI",
          layout: "list",
          items: [
            link("https://console.anthropic.com/", "Anthropic Console"),
            link("https://huggingface.co/", "Hugging Face"),
            link("https://www.cursor.com/", "Cursor"),
          ],
        },
        {
          name: "Prompts",
          layout: "list",
          items: [note("Prompts that work", "<p>Save prompts you reuse here, so they're one click away.</p><ul><li></li></ul>")],
        },
      ],
    },
  },
  {
    id: "home",
    name: "Personal",
    emoji: "🏠",
    description: "Everyday sites for news, money, shopping and watching.",
    page: {
      layout: "auto",
      groups: [
        {
          name: "Daily",
          layout: "tiles",
          items: [
            link("https://mail.google.com/", "Gmail"),
            link("https://news.google.com/", "News"),
            link("https://weather.com/", "Weather"),
            link("https://maps.google.com/", "Maps"),
          ],
        },
        {
          name: "Watch and listen",
          layout: "tiles",
          items: [link("https://www.youtube.com/", "YouTube"), link("https://www.netflix.com/", "Netflix"), link("https://open.spotify.com/", "Spotify")],
        },
        {
          name: "Shopping and money",
          layout: "list",
          items: [link("https://www.amazon.com/", "Amazon"), link("https://www.paypal.com/", "PayPal")],
        },
      ],
    },
  },
];

export const getTemplate = (id: string) => PAGE_TEMPLATES.find((t) => t.id === id);
