import puppeteer from "@cloudflare/puppeteer";

interface Env {
  MYBROWSER: Fetcher;
  SB_SESSIONS: KVNamespace;
  SB_USERNAME: string;
  SB_PASSWORD: string;
}

export default {
  async fetch(request: Request, env: Env) {
    // Secrets とバインディングを受け取る
    const { MYBROWSER, SB_SESSIONS, SB_USERNAME, SB_PASSWORD } = env;

    // 1) KV から既存のセッション Cookie を取得
    const cookieJson = await SB_SESSIONS.get("cookie");
    let cookies: any[] = cookieJson ? JSON.parse(cookieJson) : [];

    // 2) ブラウザ起動
    const browser = await puppeteer.launch(MYBROWSER);
    const page = await browser.newPage();

    // 3) Cookie がなければログイン処理を実行し、KV に保存
    if (cookies.length === 0) {
      await page.goto("https://scrapbox.io/login", { waitUntil: "networkidle0" });
      // BOT 用のアカウント情報 (Wrangler secrets) を使ってログイン
      await page.type('input[name="login"]', SB_USERNAME);
      await page.type('input[name="password"]', SB_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: "networkidle0" });
      cookies = await page.cookies();
      await SB_SESSIONS.put("cookie", JSON.stringify(cookies));
    } else {
      await page.setCookie(...cookies);
    }

    // 4) リクエストボディをパース
    const body = (await request.json()) as { project: string; page: string; text: string };
    const { project, page: pageTitle, text } = body;
    if (!project || !pageTitle || !text) {
      return new Response("Missing parameters: project, page, or text", { status: 400 });
    }

    // 5) 編集ページを開き追記＆保存
    const editUrl = `https://scrapbox.io/${project}/${encodeURIComponent(pageTitle)}#edit`;
    await page.goto(editUrl, { waitUntil: "networkidle0" });
    await page.waitForSelector("textarea");
    await page.evaluate((newText: string) => {
      const ta = document.querySelector<HTMLTextAreaElement>("textarea")!;
      ta.value += "\n" + newText;
      // @ts-ignore
      Scrapbox.EditorModel.instance.save();
    }, text);

    // 6) クローズしてレスポンス
    await browser.close();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
