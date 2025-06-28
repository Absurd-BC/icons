// 路径测试和修复脚本 - test_paths.js
// 在 tubiao.js 所在目录运行此脚本来测试通知功能

const fs = require('fs');
const path = require('path');

// ---- 配置路径 ----
const botDir = '/Users/bc/Library/CloudStorage/Dropbox/code/tgiconbot'; // 修改为你的实际bot目录
const iconDir = '/Users/bc/Library/CloudStorage/Dropbox/code/icons';    // tubiao.js所在目录

console.log('🔍 路径测试和修复脚本');
console.log('==========================================');

// 1. 检查目录是否存在
console.log('\n📁 检查目录结构:');
console.log(`Bot目录: ${botDir}`);
console.log(`  - 存在: ${fs.existsSync(botDir) ? '✅' : '❌'}`);

console.log(`Icons目录: ${iconDir}`);
console.log(`  - 存在: ${fs.existsSync(iconDir) ? '✅' : '❌'}`);

// 2. 检查关键文件
console.log('\n📄 检查关键文件:');
const botFile = path.join(botDir, 'bot.js');
const tubiaoFile = path.join(iconDir, 'tubiao.js');

console.log(`bot.js: ${botFile}`);
console.log(`  - 存在: ${fs.existsSync(botFile) ? '✅' : '❌'}`);

console.log(`tubiao.js: ${tubiaoFile}`);
console.log(`  - 存在: ${fs.existsSync(tubiaoFile) ? '✅' : '❌'}`);

// 3. 测试通知文件创建
console.log('\n🧪 测试通知文件创建:');

function testNotifySuccess() {
  try {
    if (!fs.existsSync(botDir)) {
      console.error('❌ Bot目录不存在，无法创建通知文件');
      return false;
    }
    
    const notifyFile = path.join(botDir, 'notify_success.json');
    const testNotification = {
      type: 'success',
      message: '🧪 测试通知',
      timestamp: new Date().toISOString(),
      url: 'https://github.com/test/test'
    };
    
    fs.writeFileSync(notifyFile, JSON.stringify(testNotification, null, 2));
    console.log(`✅ 成功创建测试通知文件: ${notifyFile}`);
    
    // 检查文件是否真的存在
    if (fs.existsSync(notifyFile)) {
      console.log('✅ 通知文件确认存在');
      
      // 清理测试文件
      setTimeout(() => {
        try {
          fs.unlinkSync(notifyFile);
          console.log('🗑️ 测试文件已清理');
        } catch (error) {
          console.log('ℹ️ 测试文件清理失败（这是正常的，如果bot正在监听）');
        }
      }, 3000);
      
      return true;
    } else {
      console.error('❌ 通知文件创建失败');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 创建测试通知失败:', error.message);
    return false;
  }
}

const notifyTest = testNotifySuccess();

// 4. 检查权限
console.log('\n🔐 检查目录权限:');
try {
  const testFile = path.join(botDir, 'test_permission.txt');
  fs.writeFileSync(testFile, 'permission test');
  fs.unlinkSync(testFile);
  console.log(`✅ Bot目录有写入权限`);
} catch (error) {
  console.error(`❌ Bot目录无写入权限: ${error.message}`);
}

// 5. 生成修复建议
console.log('\n🛠️ 修复建议:');

if (!fs.existsSync(botDir)) {
  console.log('❌ 请修正 botDir 路径，确保指向正确的bot目录');
  console.log(`   当前设置: ${botDir}`);
  console.log('   建议: 使用 find /Users/bc -name "bot.js" -type f 查找正确路径');
}

if (!notifyTest) {
  console.log('❌ 通知文件创建失败，请检查:');
  console.log('   1. 路径是否正确');
  console.log('   2. 是否有写入权限');
  console.log('   3. 目录是否存在');
}

// 6. 动态路径查找
console.log('\n🔍 自动查找bot.js路径:');
const { execSync } = require('child_process');

try {
  const findResult = execSync('find /Users/bc -name "bot.js" -type f 2>/dev/null', { encoding: 'utf8' });
  const foundPaths = findResult.trim().split('\n').filter(p => p);
  
  if (foundPaths.length > 0) {
    console.log('找到以下bot.js文件:');
    foundPaths.forEach((filePath, index) => {
      const dir = path.dirname(filePath);
      console.log(`  ${index + 1}. ${filePath}`);
      console.log(`     目录: ${dir}`);
    });
    
    if (foundPaths.length === 1) {
      const correctBotDir = path.dirname(foundPaths[0]);
      console.log(`\n💡 建议修改 tubiao.js 中的 botDir 为:`);
      console.log(`const botDir = '${correctBotDir}';`);
    }
  } else {
    console.log('❌ 未找到bot.js文件');
  }
} catch (error) {
  console.log('ℹ️ 无法自动查找路径:', error.message);
}

// 7. 生成完整的修复方案
console.log('\n📋 完整修复步骤:');
console.log('1. 停止当前运行的bot: pkill -f "node.*start.js"');
console.log('2. 找到正确的bot目录路径');
console.log('3. 修改 tubiao.js 中的 botDir 变量');
console.log('4. 重新启动bot: node start.js');
console.log('5. 测试上传功能，观察通知是否正常');

console.log('\n🎯 测试完成！');
