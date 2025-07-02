const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ---- 通知Bot功能 ----
function notifyBotSuccess() {
  try {
    // 通知文件应该写入到bot.js所在的目录
    const botDir = '/root/apps/telegram-bot'; // 修改为你的bot.js实际路径
    
    // 确保目录存在
    if (!fs.existsSync(botDir)) {
      console.error('❌ Bot目录不存在:', botDir);
      return;
    }
    
    const notifyFile = path.join(botDir, 'notify_success.json');
    const notification = {
      type: 'success',
      message: '🎉 图标库同步成功！',
      timestamp: new Date().toISOString(),
      url: `https://github.com/${username}/${repo}/blob/${branch}/tubiao.json`,
      rawUrl: `https://raw.githubusercontent.com/${username}/${repo}/${branch}/tubiao.json`
    };
    
    fs.writeFileSync(notifyFile, JSON.stringify(notification, null, 2));
    console.log('📢 成功通知已发送给Bot:', notifyFile);
  } catch (error) {
    console.error('❌ 发送成功通知失败:', error.message);
    console.error('详细错误:', error);
  }
}

function notifyBotError(errorMsg) {
  try {
    // 通知文件应该写入到bot.js所在的目录
    const botDir = '/root/apps/telegram-bott'; // 修改为你的bot.js实际路径
    
    // 确保目录存在
    if (!fs.existsSync(botDir)) {
      console.error('❌ Bot目录不存在:', botDir);
      return;
    }
    
    const notifyFile = path.join(botDir, 'notify_error.json');
    const notification = {
      type: 'error',
      message: '❌ 图标库同步失败',
      error: errorMsg,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(notifyFile, JSON.stringify(notification, null, 2));
    console.log('📢 错误通知已发送给Bot:', notifyFile);
  } catch (error) {
    console.error('❌ 发送错误通知失败:', error.message);
    console.error('详细错误:', error);
  }
}

// ---- 配置参数 ----
const username = 'Absurd-BC';
const repo = 'icons';
const branch = 'main';
const iconDir = process.argv[2] || 'pic'; // 支持传入目录参数
const size = 512;
const upscaylPath = '/root/apps/realesrgan-ncnn-vulkan-20220424-ubuntu/realesrgan-ncnn-vulkan';
const model = process.argv[3] || 'realesrgan-x4plus';
const scale = 4;

// 判断是否为单文件处理模式
const isSingleFileMode = iconDir.includes('temp_') || iconDir.includes('processing');

// ---- 上传者记录处理 ----
const uploaderFile = path.join(__dirname, 'uploaders.json');
let uploaders = {};

function loadUploaders() {
  try {
    if (fs.existsSync(uploaderFile)) {
      uploaders = JSON.parse(fs.readFileSync(uploaderFile, 'utf8'));
    }
  } catch (error) {
    console.error('读取上传者记录失败:', error.message);
  }
}

function saveUploaders() {
  try {
    fs.writeFileSync(uploaderFile, JSON.stringify(uploaders, null, 2));
  } catch (error) {
    console.error('保存上传者记录失败:', error.message);
  }
}

// ---- 上次处理记录，避免重复 ----
const hashFile = path.join(iconDir, '.last_hash.json');
let lastHash = {};
if (fs.existsSync(hashFile) && !isSingleFileMode) {
  try { lastHash = JSON.parse(fs.readFileSync(hashFile, 'utf8')); } catch {};
}

// 计算文件哈希的辅助函数
function calculateFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// 检查图片是否有透明通道
const isTransparent = async (filePath) => {
  try {
    const img = sharp(filePath);
    const { channels } = await img.metadata();
    
    // 如果没有alpha通道，肯定不透明
    if (channels < 4) return false;
    
    // 检查alpha通道是否有非255的值
    const buffer = await img.raw().toBuffer();
    for (let i = 3; i < buffer.length; i += 4) {
      if (buffer[i] < 255) return true;
    }
    return false;
  } catch (error) {
    console.error(`检查透明度失败: ${filePath}`, error.message);
    return false;
  }
};

// 扫描目录并计算哈希
const filesAll = fs.readdirSync(iconDir)
  .filter(f => !f.startsWith('.') && !fs.statSync(path.join(iconDir, f)).isDirectory());

const fileHashes = {};
const toProcess = [];

// 只处理非生成的文件（排除 _radius.png 和 _round.png）
const sourceFiles = filesAll.filter(f => !f.includes('_radius.png') && !f.includes('_round.png'));

console.log(`🔍 扫描到 ${sourceFiles.length} 个源文件`);

for (const file of sourceFiles) {
  const fullPath = path.join(iconDir, file);
  const ext = path.extname(file).toLowerCase();
  const hash = calculateFileHash(fullPath);
  
  // 保证后缀统一为 .png
  const pngName = file.replace(/\.[^.]+$/, '.png');
  const baseName = pngName.replace('.png', '');
  
  // 记录所有文件的哈希（用于最终的JSON生成）
  fileHashes[pngName] = hash;
  
  // 在单文件模式下或文件有变化时才处理
  const shouldProcess = isSingleFileMode || !lastHash[pngName] || lastHash[pngName] !== hash;
  
  if (shouldProcess) {
    toProcess.push({ file, ext, fullPath, pngName, baseName });
    if (!isSingleFileMode) {
      console.log(`🔄 检测到变化: ${file} (${shouldProcess ? '新文件或已修改' : '强制处理'})`);
    }
  } else {
    console.log(`ℹ️ 跳过未变化文件: ${file}`);
  }
}

(async function main() {
  console.log('🚀 tubiao.js 开始执行');
  console.log('📂 目标目录：', path.resolve(iconDir));
  console.log('🔧 处理模式：', isSingleFileMode ? '单文件处理' : '批量处理');
  console.log(`🔍 扫描到 ${sourceFiles.length} 个源文件`);
  console.log(`⚙️ 有 ${toProcess.length} 个文件需要处理`);

  // 加载上传者记录
  if (!isSingleFileMode) {
    loadUploaders();
  }

  // 如果没有变动且非单文件模式，跳过全部耗时处理
  if (toProcess.length === 0 && !isSingleFileMode) {
    console.log('ℹ️ 无新文件或修改，跳过处理。');
    
    // 即使没有新文件，也要更新所有现有文件的哈希记录
    const allPngFiles = fs.readdirSync(iconDir).filter(f => f.endsWith('.png'));
    for (const pngFile of allPngFiles) {
      const hash = calculateFileHash(path.join(iconDir, pngFile));
      if (hash) {
        fileHashes[pngFile] = hash;
      }
    }
  } else {
    // 1. 转 PNG + 超分 + 缩放
    for (const { file, ext, fullPath, pngName, baseName } of toProcess) {
      let pngPath = fullPath;

      // 转 PNG（保持透明度）
      if (ext !== '.png') {
        pngPath = path.join(iconDir, pngName);
        console.log(`   🔄 转PNG: ${file} → ${pngName}`);
        await sharp(fullPath)
          .png({ 
            compressionLevel: 6,
            adaptiveFiltering: false,
            force: true
          })
          .toFile(pngPath);
        if (!isSingleFileMode) {
          fs.unlinkSync(fullPath);
        }
      }

      // 检查图片是否透明（用于后续裁剪判断）
      const isTransparentImage = await isTransparent(pngPath);
      console.log(`   🔍 透明度检测: ${pngName} - ${isTransparentImage ? '透明' : '非透明'}`);

      // 超分条件：任意边 < size*scale（透明图片也执行超分）
      const meta = await sharp(pngPath).metadata();
      if (meta.width < size * scale || meta.height < size * scale) {
        console.log(`   🚀 超分: ${pngName} (${meta.width}×${meta.height} → ×${scale})`);
        const upPath = pngPath + '.upc.png';
        try {
          execSync(`"${upscaylPath}" -i "${pngPath}" -o "${upPath}" -n "${model}" -s ${scale}`, { 
            stdio: 'pipe',
            timeout: 120000 // 2分钟超时
          });
          if (fs.existsSync(upPath)) {
            fs.renameSync(upPath, pngPath);
            console.log('    🙌 超分完成');
          } else {
            console.log('    ⚠️ 超分输出文件未生成，跳过');
          }
        } catch (error) {
          console.error('    ❌ 超分失败:', error.message);
          console.log('    ℹ️ 继续使用原图进行后续处理');
        }
      } else {
        console.log(`   ℹ️ 分辨率已 >= ${size*scale}，跳过超分`);
      }

      // 缩放到目标尺寸（透明和非透明都执行，但背景处理不同）
      console.log(`   📏 缩放到 ${size}×${size}`);
      const tmpPath = pngPath + '.tmp.png';
      
      if (isTransparentImage) {
        // 透明图片：保持透明背景
        await sharp(pngPath)
          .resize(size, size, { 
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // 透明背景
          })
          .png({ compressionLevel: 6, force: true })
          .toFile(tmpPath);
        console.log(`   🏳️ 透明图片缩放完成，保持透明背景`);
      } else {
        // 非透明图片：白色背景
        await sharp(pngPath)
          .resize(size, size, { 
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 } // 白色背景
          })
          .toFile(tmpPath);
        console.log(`   🎨 非透明图片缩放完成，白色背景`);
      }
      
      fs.renameSync(tmpPath, pngPath);
      
      // 更新处理后的源文件哈希
      fileHashes[pngName] = calculateFileHash(pngPath);
    }

    // 2. 圆角 / 圆形遮罩（仅针对本次变动文件，透明图片跳过）
    console.log('🔳 生成圆角 / 圆形');
    
    for (const { pngName, baseName } of toProcess) {
      const inputPath = path.join(iconDir, pngName);
      
      // 检查是否透明
      const isTransparentImage = await isTransparent(inputPath);
      if (isTransparentImage) {
        console.log(`   🏳️ 透明背景图片，跳过圆角和圆形裁剪：${pngName}`);
        continue; // 透明图片跳过圆角和圆形处理
      }
      
      // 非透明图片生成圆角版本
      const radiusPath = path.join(iconDir, `${baseName}_radius.png`);
      await sharp(inputPath)
        .composite([{ 
          input: Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.floor(size*0.18)}" ry="${Math.floor(size*0.18)}"/></svg>`), 
          blend:'dest-in' 
        }])
        .toFile(radiusPath);
      console.log(`   🔲 圆角：${path.basename(radiusPath)}`);
      
      // 记录圆角文件哈希
      fileHashes[`${baseName}_radius.png`] = calculateFileHash(radiusPath);

      // 生成圆形版本
      const roundPath = path.join(iconDir, `${baseName}_round.png`);
      await sharp(inputPath)
        .composite([{ 
          input: Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></svg>`), 
          blend:'dest-in' 
        }])
        .toFile(roundPath);
      console.log(`   ⚪ 圆形：${path.basename(roundPath)}`);
      
      // 记录圆形文件哈希
      fileHashes[`${baseName}_round.png`] = calculateFileHash(roundPath);
    }
  }

  // 3. 生成 tubiao.json（只在非单文件模式下执行）
  if (!isSingleFileMode) {
    console.log('📄 生成 tubiao.json');
    
    const allPngFiles = fs.readdirSync(iconDir).filter(f => f.endsWith('.png'));
    const icons = [];
    
    // 按文件类型分组
    const fileGroups = {};
    
    for (const fileName of allPngFiles) {
      let baseName, type;
      
      if (fileName.includes('_radius.png')) {
        baseName = fileName.replace('_radius.png', '');
        type = 'radius';
      } else if (fileName.includes('_round.png')) {
        baseName = fileName.replace('_round.png', '');
        type = 'round';
      } else {
        baseName = fileName.replace('.png', '');
        type = 'original';
      }
      
      if (!fileGroups[baseName]) {
        fileGroups[baseName] = {};
      }
      fileGroups[baseName][type] = fileName;
    }
    
    // 决定每个图标使用哪个版本 - 修复：透明图片只上传原版，非透明上传所有版本
    for (const [baseName, versions] of Object.entries(fileGroups)) {
      // 检查原图是否透明
      let isOriginalTransparent = false;
      if (versions.original) {
        const originalPath = path.join(iconDir, versions.original);
        isOriginalTransparent = await isTransparent(originalPath);
      }
      
      // 上传逻辑
      const filesToUpload = [];
      
      if (isOriginalTransparent && versions.original) {
        // 透明图片：只上传原版
        filesToUpload.push({
          name: baseName,
          file: versions.original,
          type: 'transparent'
        });
        console.log(`   🏳️ 添加透明版本（仅原版）: ${versions.original}`);
      } else {
        // 非透明图片：上传圆角 + 圆形（不上传原版）
        if (versions.radius) {
          filesToUpload.push({
            name: baseName, // 主版本使用原名称
            file: versions.radius,
            type: 'radius'
          });
          console.log(`   🔲 添加圆角版本（主）: ${versions.radius}`);
        }
        
        if (versions.round) {
          filesToUpload.push({
            name: `${baseName}_round`,
            file: versions.round,
            type: 'round'
          });
          console.log(`   ⚪ 添加圆形版本: ${versions.round}`);
        }
        
        // 如果既没有圆角也没有圆形，才使用原版
        if (!versions.radius && !versions.round && versions.original) {
          filesToUpload.push({
            name: baseName,
            file: versions.original,
            type: 'original'
          });
          console.log(`   📦 添加原版（备用）: ${versions.original}`);
        }
      }
      
      // 添加到图标列表
      for (const fileInfo of filesToUpload) {
        const iconData = { 
          name: fileInfo.name, 
          url: `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${iconDir}/${fileInfo.file}`
        };
        
        // 添加上传者信息
        const uploaderInfo = uploaders[baseName];
        if (uploaderInfo) {
          iconData.uploader = {
            userName: uploaderInfo.userName,
            userId: uploaderInfo.userId,
            uploadTime: uploaderInfo.uploadTime
          };
        }
        
        icons.push(iconData);
      }
    }
    
    // 按名称排序
    icons.sort((a, b) => a.name.localeCompare(b.name));
    
    const tubiaoData = {
      name: "超分emby图标",
      description: "自动处理的高质量图标库，包含多种样式版本",
      updateTime: new Date().toISOString(),
      totalIcons: icons.length,
      icons
    };
    
    fs.writeFileSync('tubiao.json', JSON.stringify(tubiaoData, null, 2));
    console.log(`📄 tubiao.json 已生成，包含 ${icons.length} 个图标`);

    // 4. 更新 hash 记录
    fs.writeFileSync(hashFile, JSON.stringify(fileHashes, null, 2));

    // --- 5. 自动同步到GitHub ---
    try {
      console.log('📤 开始同步到GitHub...');
      
      // 检查git状态
      try {
        execSync('git status --porcelain', { stdio: 'pipe' });
      } catch (error) {
        console.error('❌ Git 仓库状态检查失败:', error.message);
        throw error;
      }
      
      // 添加文件到暂存区
      console.log('📝 添加文件到暂存区...');
      execSync('git add tubiao.json pic/ uploaders.json', { stdio: 'inherit' });
      
      // 检查是否有变更
      try {
        execSync('git diff --cached --quiet', { stdio: 'pipe' });
        console.log('✅ 没有变更，无需同步');
        return; // 没有变更，直接返回
      } catch {
        // 有变更，继续提交
        console.log('📝 检测到变更，准备提交...');
      }
      
      // 提交变更
      const commitMsg = `自动同步：更新于 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
      console.log(`📝 提交消息: ${commitMsg}`);
      execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
      
      // 推送到远程仓库
      console.log('🚀 推送到远程仓库...');
      execSync('git push origin main', { stdio: 'inherit' });
      
      console.log('✅ 同步到GitHub完成');
      
      // 通知bot同步成功
      notifyBotSuccess();
      
    } catch (err) {
      console.error('❌ 同步失败:', err.message);
      console.error('详细错误:', err.toString());
      
      // 尝试重置并重新同步
      try {
        console.log('🔄 尝试重置并重新同步...');
        execSync('git reset HEAD~1 --soft', { stdio: 'pipe' }); // 撤销上次提交但保留更改
        execSync('git add .', { stdio: 'inherit' });
        execSync(`git commit -m "重新同步: ${new Date().toLocaleString('zh-CN')}"`, { stdio: 'inherit' });
        execSync('git push origin main --force-with-lease', { stdio: 'inherit' });
        console.log('✅ 重新同步成功');
        notifyBotSuccess();
      } catch (retryError) {
        console.error('❌ 重新同步也失败:', retryError.message);
        notifyBotError(err.message);
      }
    }
  }

  console.log('🏁 tubiao.js 执行结束');
  if (!isSingleFileMode) {
    console.log(`📊 最终记录了 ${Object.keys(fileHashes).length} 个文件的哈希值`);
    console.log('🎯 上传策略：透明背景（原版） → 非透明背景（圆角+圆形，不含原版）');
  } else {
    console.log('📦 单文件处理完成，生成了所有样式版本');
  }
})();