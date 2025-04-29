import puppeteer from "@cloudflare/puppeteer";

interface Env {
  MYBROWSER: Fetcher;
}

export default {
  async fetch(request, env) {
    // クエリから URL を取得
    const url = new URL(request.url).searchParams.get("url");
    if (!url) {
      return new Response("Please add ?url=<target_url>", { status: 400 });
    }

    // ブラウザ起動
    const browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();

    // ページへ遷移
    await page.goto(url, { waitUntil: "networkidle0" });

    // スクリーンショット取得
    const buffer = await page.screenshot();
    await browser.close();

    return new Response(buffer, {
      headers: { "Content-Type": "image/png" },
    });
  },
} satisfies ExportedHandler<Env>;
