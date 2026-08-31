/* ==========================================================================
   posts.js — the whole news section lives here.

   TO ADD A POST: copy a block, paste it at the TOP of the array, change the
   fields. Save. That's it — it shows up on news.html and gets its own page.

   slug     -> the URL: news-post.html?p=your-slug   (letters, numbers, dashes)
   date     -> YYYY-MM-DD
   category -> groups it under a filter button. Reuse an existing one or invent one.
   excerpt  -> 1-2 sentences shown on the card
   body     -> the article. Plain HTML: <p>, <h2>, <ul><li>, <a href="">.
   ========================================================================== */

window.POSTS = [
  {
    slug: "reelection-announcement",
    title: "Hulsey announces re-election campaign for House District 15",
    date: "2026-01-08",
    category: "Campaign",
    excerpt:
      "After three years in Montgomery, Leigh is asking District 15 for another term — with the same approach that got her here.",
    body: `
      <p>State Representative Leigh Hulsey announced this week that she is running for
      re-election in Alabama House District 15.</p>

      <p>The announcement was short on fanfare and long on the thing she keeps coming back
      to: showing up. Since taking office in November 2022, Leigh has represented Helena,
      McCalla, Bessemer, western Hoover and the communities in between — and she has spent
      most of that time in rooms that don't make the news. City council chambers. School
      board meetings. Ballfields. The gym she owns in Alabaster.</p>

      <h2>The record so far</h2>
      <p>Over her first term, Leigh has worked with local leaders to bring more than
      <strong>$360,000 in grant funding</strong> back to House District 15 for community
      needs and local projects. She sponsored the FOCUS Act, the bell-to-bell school cell
      phone law that passed the House 79&ndash;15 and was signed by Governor Ivey in May 2025.
      In 2026, she carried the bill reining in long-term tax breaks for data centers.</p>

      <h2>Why she's running again</h2>
      <p>The pitch is not complicated. District 15 is growing fast, and growth brings bills
      that come due: roads, classrooms, first responders, water. Leigh's argument is that
      the district is better off with someone in Montgomery who already knows which
      phone calls to make.</p>

      <p>"The citizens of District 15 deserve a God-fearing, qualified, conservative,
      pro-jobs leader fighting for them."</p>

      <p>If you want to help, the fastest ways are a yard sign, an hour of door knocking,
      or a contribution of any size. All three matter more than people think.</p>
    `,
  },
  {
    slug: "data-center-tax-reform",
    title: "Hulsey bill reining in data center tax breaks passes the Legislature",
    date: "2026-04-10",
    category: "Economy",
    excerpt:
      "HB399 cuts the maximum tax abatement for large data centers from 30 years to 20 — and passed the Senate unanimously.",
    body: `
      <p>Alabama is in the middle of a data center boom. The buildings are enormous, they
      draw an extraordinary amount of power, and the tax abatements used to land them can
      run for decades.</p>

      <p>House Bill 399, sponsored by Rep. Leigh Hulsey, R&ndash;Helena, puts a limit on that.
      Beginning January 1, 2027, the maximum abatement period for data processing centers
      drops from 30 years to 20 unless the project meets certain community investment
      thresholds. It also restricts the sales tax abatement on the state's 4% sales and use
      tax for facilities with a total peak demand of 100 megawatts or greater.</p>

      <h2>What it does and doesn't do</h2>
      <ul>
        <li>It does not end incentives for data centers. Alabama still competes for them.</li>
        <li>It does put a ceiling on how long a single project can sit off the tax rolls.</li>
        <li>It ties the longest deals to real investment back into the community hosting them.</li>
      </ul>

      <p>The bill passed the Senate unanimously and was enacted in April 2026.</p>

      <h2>The thinking behind it</h2>
      <p>Leigh has run a small business in Alabaster for years. Her view is that a tax
      structure works when everybody can see the deal and the math holds up over time. A
      thirty-year abatement outlasts the officials who approved it, the school system that
      absorbs the growth, and often the technology itself. Twenty years, with strings, is
      still a serious offer — it's just one the state can defend.</p>
    `,
  },
  {
    slug: "focus-act-signed",
    title: "Governor Ivey signs the FOCUS Act, Hulsey's school cell phone bill",
    date: "2025-05-15",
    category: "Education",
    excerpt:
      "Bell to bell, phones go away. Alabama's classrooms got quieter thanks to HB166 — and teachers noticed immediately.",
    body: `
      <p>Governor Kay Ivey signed the FOCUS Act — Freeing Our Classrooms of Unnecessary
      Screens for Safety — into law in May 2025. The bill, HB166, was sponsored by Rep.
      Leigh Hulsey.</p>

      <p>Under the law, students in Alabama public elementary and secondary schools may not
      possess or use a wireless communication device during the school day unless it is
      powered off and stored away. Bell to bell.</p>

      <h2>How it passed</h2>
      <p>The House passed it 79&ndash;15. The Senate passed it 30&ndash;2. In a building where almost
      nothing is unanimous, those are remarkable numbers — and they came from teachers and
      principals who had been asking for exactly this.</p>

      <h2>The exceptions matter</h2>
      <ul>
        <li>Emergencies.</li>
        <li>Students with an Individualized Education Plan or a Section 504 plan.</li>
        <li>When a device is genuinely needed for instruction.</li>
      </ul>

      <p>The law also requires local boards of education to adopt an internet safety policy
      for school devices, and requires students to complete a social media safety course
      before they begin eighth grade.</p>

      <h2>In her words</h2>
      <p>"As a parent, equipping my children to excel in all aspects of life is priority
      number one, and what they learn in the classroom plays an immense role in that."</p>

      <p>Leigh has three grown children and spent twelve years at home raising them before
      going back to work. She has said more than once that this bill started as a parent
      problem before it was ever a policy problem.</p>
    `,
  },
  {
    slug: "grant-funding-district-15",
    title: "More than $360,000 brought home to District 15",
    date: "2025-11-12",
    category: "District",
    excerpt:
      "Grant money isn't glamorous. It's ballfields, equipment, paving and public safety — and it adds up.",
    body: `
      <p>One of the least visible parts of a state representative's job is knowing which
      pots of money exist and how to get a local project in front of them. It rarely makes
      headlines. It shows up later as a resurfaced road or a piece of equipment a
      department didn't have to fundraise for.</p>

      <p>Working with local leaders, Leigh has brought more than <strong>$360,000 in grant
      funding</strong> back to House District 15 to support community needs and local
      projects.</p>

      <h2>How this actually works</h2>
      <p>A mayor, a chief, a school, or a civic group identifies a need. The office helps
      match it to a funding source, gets the paperwork right, and then follows the request
      through the process in Montgomery until there's a check or a clear no.</p>

      <p>If your city, school, department or nonprofit in District 15 has a project that
      might qualify, get in touch. The worst answer is no, and it costs you an email.</p>
    `,
  },
  {
    slug: "helena-council-to-montgomery",
    title: "From the Helena council table to the Alabama House",
    date: "2025-08-04",
    category: "District",
    excerpt:
      "Municipal budgets, road projects and planning meetings turned out to be good training for the State House.",
    body: `
      <p>Before Montgomery, Leigh served on the Helena City Council. The work there was
      unglamorous in the best way: municipal budgets, economic development, and planning
      and funding road projects.</p>

      <p>That experience shaped how she legislates. City government is where an abstract
      policy becomes a line item, a contractor, and a completed project — or doesn't. It's
      also where you learn that the person complaining at the podium usually has a point.</p>

      <h2>Carried into the House</h2>
      <p>In January 2023, at the start of her first term, House Republicans elected Leigh
      as the caucus's freshman representative — the voice for first-term members in
      leadership discussions.</p>

      <h2>What she's focused on</h2>
      <ul>
        <li>Economic development and jobs in a fast-growing district</li>
        <li>Public education and what happens inside the classroom</li>
        <li>Transportation and the roads growth is putting pressure on</li>
        <li>Protecting unborn life</li>
        <li>Supporting active-duty service members, military families and veterans</li>
      </ul>

      <p>The through line is local. District 15 covers parts of Helena, McCalla, Bessemer
      and western Hoover, and every one of them is changing quickly.</p>
    `,
  },
];
