const path = require('node:path');
const fs = require('fs-extra');
const svgstore = require('svgstore');
const crypto = require('node:crypto');
const { pinyin } = require('pinyin-pro');

const rootDir = process.cwd();

const compileFont = async ({ name, inputDir, outputDir }) => {
  const keyFile = await fs.readFile(path.resolve(inputDir, 'iconfont.json'));
  const md5 = crypto.createHash('md5');
  const md5Str = md5.update(keyFile).digest('hex');
  const outputName = name + '_' + md5Str.slice(0, 12);
  const distDir = path.resolve(outputDir, outputName);
  await fs.copy(inputDir, distDir);
  return outputName;
};

const compileColorfulFont = async ({ name, inputDir, outputDir }) => {
  const renderTemplate = (svgStr, outputName) => `var dom = document.createElement("div");dom.setAttribute("aria-hidden", "true");dom.id = "${outputName}";dom.style.position = "absolute";dom.style.width = 0;dom.style.height = 0;dom.style.overflow = "hidden";dom.innerHTML = '${svgStr}';!document.getElementById(dom.id) && document.body.append(dom);`;

  const files = await fs.readdir(inputDir);
  const sprites = svgstore({ renameDefs: true });
  const list = [];
  for (let filename of files) {
    const baseName = filename.replace(path.extname(filename), '');
    let newName = `icon-color-${name}-` + pinyin(baseName, {
      toneType: 'none', type: 'array', v: true
    }).join('');
    newName = newName
      .replace(/[^a-zA-Z0-9]/g, '') // 移除非字母数字字符
      .replace(/\s+/g, '_') // 空格转下划线
      .replace(/([a-z])([A-Z])/g, '$1_$2') // 驼峰转下划线
      .toLowerCase() // 转为小写
      .replace(/_+/g, '_'); // 合并连续下划线

    const file = await fs.readFile(path.resolve(inputDir, filename), 'utf8');
    sprites.add(newName, file);
    list.push({
      name: newName, font_class: newName
    });
  }

  const svgStr = sprites.toString().replace(/[\n\r]*/g, '');
  const md5 = crypto.createHash('md5');
  const md5Str = md5.update(svgStr).digest('hex');
  const outputName = name + '_' + md5Str.slice(0, 12);
  const distDir = path.resolve(outputDir, outputName);
  await fs.emptydir(distDir);
  await fs.writeFile(path.resolve(distDir, 'iconfont.js'), renderTemplate(svgStr, outputName));
  await fs.writeFile(path.resolve(distDir, 'iconfont.svg'), svgStr);
  await fs.writeJson(path.resolve(distDir, 'iconfont.json'), {
    glyphs: list
  });

  return outputName;
};

module.exports = async options => {
  const { inputDir, outputDir } = Object.assign({}, options);
  const srcDir = path.resolve(rootDir, inputDir || process.env.INPUT || 'src/icon');
  const distDir = path.resolve(rootDir, outputDir || process.env.OUTPUT || 'public/icon-build');
  const output = {};

  const list = await fs.readdir(srcDir);
  for (let name of list) {
    const stats = await fs.stat(path.resolve(srcDir, name));
    if (!stats.isDirectory()) {
      continue;
    }
    if (name.indexOf('-colorful') > -1) {
      output[name] = await compileColorfulFont({
        name: name.replace('-colorful', ''), inputDir: path.resolve(srcDir, name), outputDir: distDir
      });
    } else {
      output[name] = await compileFont({ name, inputDir: path.resolve(srcDir, name), outputDir: distDir });
    }
  }
  await fs.writeJson(path.resolve(distDir, 'manifest.json'), output);
  await fs.writeFile(path.resolve(distDir, 'index.js'), Object.keys(output).map((fontName) => {
    const name = output[fontName];
    const isColorful = /-colorful$/.test(fontName);
    return `import './${name}/${isColorful ? 'iconfont' : 'iconfont.css'}';`;
  }).join('\n'));
  console.log('执行完成:', JSON.stringify(output, null, 2));
};
