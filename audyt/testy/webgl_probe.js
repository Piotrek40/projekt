const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  for (const args of [[], ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']]) {
    const browser = await chromium.launch({ headless: true, args });
    const page = await browser.newPage();
    const r = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      if (!gl) return { webgl2: false, webgpu: !!navigator.gpu };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        webgl2: true,
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        floatBuf: !!gl.getExtension('EXT_color_buffer_float'),
        astc: !!gl.getExtension('WEBGL_compressed_texture_astc'),
        etc: !!gl.getExtension('WEBGL_compressed_texture_etc'),
        s3tc: !!gl.getExtension('WEBGL_compressed_texture_s3tc'),
        webgpu: !!navigator.gpu,
      };
    });
    console.log(JSON.stringify(args), JSON.stringify(r));
    await browser.close();
  }
})();
