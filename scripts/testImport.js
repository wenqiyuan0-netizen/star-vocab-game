const fs = require('fs');
const path = require('path');

/**
 * 测试导入逻辑
 * 验证 WordProcessor 能够正确处理生成的词汇文件
 */

// 模拟 WordProcessor 的逻辑（简化版）
function simulateImport(inputText) {
  const lines = inputText.split('\n');
  const words = [];
  const duplicates = [];

  const seenWords = new Set();

  lines.forEach((line, index) => {
    const raw = line.trim();
    if (!raw) return;

    const parts = raw.split(/;|；/);
    if (parts.length < 2) {
      console.log(`❌ 第 ${index + 1} 行格式错误: ${raw}`);
      return;
    }

    const deRaw = parts[0].trim();
    const cn = parts[1].trim();

    // 提取冠词和单词
    let gender = null;
    let deClean = deRaw;

    const articleMatch = deRaw.match(/^(der|die|das)\s+(.+)$/i);
    if (articleMatch) {
      const article = articleMatch[1].toLowerCase();
      deClean = articleMatch[2].trim();
      gender = article === 'der' ? 'm' : (article === 'die' ? 'f' : 'n');
    }

    // 去重检查
    const key = deClean.toLowerCase();
    if (seenWords.has(key)) {
      duplicates.push(deClean);
      return;
    }
    seenWords.add(key);

    words.push({
      de: deClean,
      cn,
      gender,
      original: deRaw
    });
  });

  return { words, duplicates };
}

// 测试主函数
function main() {
  console.log('=== 导入逻辑测试 ===\n');

  const testFiles = [
    'goethe-a1.txt',
    'goethe-a2.txt',
    'goethe-b1.txt',
    'goethe-all.txt'
  ];

  testFiles.forEach(file => {
    console.log(`\n测试文件: ${file}`);
    console.log('─'.repeat(50));

    const filePath = path.join(__dirname, '..', 'public', 'dictionaries', file);

    if (!fs.existsSync(filePath)) {
      console.log('❌ 文件不存在');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const result = simulateImport(content);

    console.log(`✓ 成功解析: ${result.words.length} 个单词`);

    if (result.duplicates.length > 0) {
      console.log(`⚠️  发现 ${result.duplicates.length} 个重复词`);
    }

    // 显示前5个单词的解析结果
    console.log('\n前5个单词:');
    result.words.slice(0, 5).forEach((word, idx) => {
      const genderStr = word.gender ? `[${word.gender}]` : '';
      console.log(`  ${idx + 1}. ${word.de} ${genderStr} → ${word.cn}`);
    });

    // 统计名词（有性别的词）
    const nounsCount = result.words.filter(w => w.gender).length;
    console.log(`\n统计: ${nounsCount} 个名词 (${((nounsCount / result.words.length) * 100).toFixed(1)}%)`);
  });

  console.log('\n=== 测试完成 ===');
}

// 执行
try {
  main();
} catch (error) {
  console.error('测试出错:', error);
  process.exit(1);
}
