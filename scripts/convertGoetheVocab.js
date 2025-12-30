const fs = require('fs');
const path = require('path');

/**
 * 简化版 Goethe 词汇转换工具
 * 只提取单词和翻译，生成可直接粘贴导入的文本格式
 */

// 处理单个词汇文件，提取单词和翻译
function processVocabFile(filePath, level) {
  console.log(`\n正在处理 ${level} 词汇...`);

  const rawData = fs.readFileSync(filePath, 'utf-8');

  // 处理可能包含多个JSON数组的文件
  let vocabList = [];
  try {
    // 尝试直接解析
    vocabList = JSON.parse(rawData);
  } catch (e) {
    // 如果失败，尝试分割多个JSON数组
    const jsonArrays = rawData.split(/\]\s*\[/);
    jsonArrays.forEach((jsonStr, idx) => {
      try {
        // 修复分割后的JSON格式
        let fixedJson = jsonStr.trim();
        if (!fixedJson.startsWith('[')) fixedJson = '[' + fixedJson;
        if (!fixedJson.endsWith(']')) fixedJson = fixedJson + ']';

        const parsed = JSON.parse(fixedJson);
        vocabList.push(...parsed);
      } catch (err) {
        console.warn(`  警告: 跳过第 ${idx + 1} 个JSON片段`);
      }
    });
  }

  const wordPairs = [];
  const seenWords = new Set(); // 用于去重（基于德语单词的小写形式）

  vocabList.forEach((entry, index) => {
    try {
      const word = entry.word?.trim();
      const translation = entry.wordTranslation?.trim();

      if (!word || !translation) {
        return;
      }

      // 去重逻辑：基于德语单词（不区分大小写）
      const dedupeKey = word.toLowerCase();
      if (seenWords.has(dedupeKey)) {
        return;
      }
      seenWords.add(dedupeKey);

      // 如果有冠词，添加到单词前面
      let fullWord = word;
      if (entry.article) {
        fullWord = `${entry.article} ${word}`;
      }

      wordPairs.push(`${fullWord};${translation}`);
    } catch (error) {
      console.error(`  处理第 ${index + 1} 个条目时出错:`, error.message);
    }
  });

  console.log(`  成功提取 ${wordPairs.length} 个单词（去重后）`);
  return wordPairs;
}

// 主函数
function main() {
  console.log('=== Goethe 词汇简化转换工具 ===\n');
  console.log('生成可直接导入的文本格式（每行一个：德语单词;中文翻译）\n');

  const inputDir = 'C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\processed';
  const outputDir = path.join(__dirname, '..', 'public', 'dictionaries');

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`创建输出目录: ${outputDir}\n`);
  }

  // 处理各个等级的词汇
  const levels = [
    { file: 'A1_Goethe_Vocabulary_List.json', level: 'A1' },
    { file: 'A2_Goethe_Vocabulary_List.json', level: 'A2' },
    { file: 'B1_Goethe_Vocabulary_List.json', level: 'B1' }
  ];

  const allWordPairs = [];
  const levelStats = [];

  levels.forEach(({ file, level }) => {
    const inputPath = path.join(inputDir, file);

    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️  文件不存在: ${inputPath}`);
      return;
    }

    const wordPairs = processVocabFile(inputPath, level);

    // 单独保存每个等级的词汇（文本格式）
    const outputPath = path.join(outputDir, `goethe-${level.toLowerCase()}.txt`);
    fs.writeFileSync(outputPath, wordPairs.join('\n'), 'utf-8');
    console.log(`  ✓ 已保存到: ${outputPath}`);

    levelStats.push({ level, count: wordPairs.length });
    allWordPairs.push(...wordPairs);
  });

  // 全局去重
  const globalDeduped = new Set(allWordPairs);
  const mergedWordPairs = Array.from(globalDeduped);

  // 保存合并后的所有词汇
  const mergedPath = path.join(outputDir, 'goethe-all.txt');
  fs.writeFileSync(mergedPath, mergedWordPairs.join('\n'), 'utf-8');

  console.log('\n=== 转换完成 ===');
  console.log('\n各等级统计:');
  levelStats.forEach(({ level, count }) => {
    console.log(`  ${level}: ${count} 个单词`);
  });
  console.log(`  合并后总计: ${mergedWordPairs.length} 个单词（全局去重）`);

  console.log('\n生成的文件:');
  levelStats.forEach(({ level }) => {
    console.log(`  - goethe-${level.toLowerCase()}.txt`);
  });
  console.log(`  - goethe-all.txt (合并所有等级)`);

  console.log(`\n输出目录: ${outputDir}`);
  console.log('\n使用方法: 打开文本文件，复制内容，粘贴到【词库】-【添加】中即可导入');
}

// 执行
try {
  main();
} catch (error) {
  console.error('转换过程出错:', error);
  process.exit(1);
}
