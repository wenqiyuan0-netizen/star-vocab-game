/**
 * 浏览器控制台词典检查脚本
 *
 * 使用方法：
 * 1. 打开浏览器控制台（F12）
 * 2. 复制粘贴此文件内容
 * 3. 运行 checkDict()
 */

async function checkDict() {
    console.log('========== 词典检查工具 ==========');

    // 1. 检查 IndexedDB
    const dbRequest = indexedDB.open('StarVocabDictionaryDB');

    return new Promise((resolve) => {
        dbRequest.onsuccess = async (event) => {
            const db = event.target.result;
            console.log('✅ IndexedDB 已连接');
            console.log('   数据库版本:', db.version);
            console.log('   Object Stores:', Array.from(db.objectStoreNames).join(', '));

            // 2. 检查词典版本
            const version = localStorage.getItem('star_vocab_dict_version');
            console.log('   词典版本标记:', version || '(未设置)');

            // 3. 查询测试单词
            const tx = db.transaction(['entries'], 'readonly');
            const store = tx.objectStore('entries');

            const testWords = ['und', 'der', 'die', 'das', 'sein', 'haben'];
            console.log('\n测试单词查询:');

            let foundCount = 0;
            let withChineseCount = 0;

            for (const word of testWords) {
                try {
                    // 使用 word_lower 索引
                    let index;
                    try {
                        index = store.index('word_lower');
                    } catch (e) {
                        index = store.index('word');
                    }

                    const request = index.getAll(word.toLowerCase());
                    const entries = await new Promise((res, rej) => {
                        request.onsuccess = () => res(request.result);
                        request.onerror = () => rej(request.error);
                    });

                    if (entries.length > 0) {
                        foundCount++;
                        const hasChinese = entries.some(e => e.translation_cn || e.has_chinese);
                        if (hasChinese) withChineseCount++;

                        console.log(`  ✅ ${word}: 找到 ${entries.length} 个词条${hasChinese ? ' (有中文)' : ' (无中文)'}`);
                    } else {
                        console.log(`  ❌ ${word}: 未找到`);
                    }
                } catch (e) {
                    console.log(`  ⚠️ ${word}: 查询出错 - ${e.message}`);
                }
            }

            console.log(`\n总结: 找到 ${foundCount}/${testWords.length} 个测试单词`);
            console.log(`      其中 ${withChineseCount} 个有中文翻译`);

            // 4. 结论
            if (foundCount === 0) {
                console.log('\n❌ 词典未导入！需要运行导入流程。');
                console.log('   解决方案: 运行 reimportDict()');
            } else if (withChineseCount < foundCount) {
                console.log('\n⚠️ 词典已导入但缺少中文翻译！');
                console.log('   解决方案: 运行 reimportDict()');
            } else {
                console.log('\n✅ 词典工作正常！');
            }

            console.log('================================');
            db.close();
            resolve({ foundCount, withChineseCount, total: testWords.length });
        };

        dbRequest.onerror = () => {
            console.log('❌ IndexedDB 连接失败:', dbRequest.error);
            resolve({ error: dbRequest.error });
        };

        dbRequest.onblocked = () => {
            console.log('⚠️ IndexedDB 被阻塞，请关闭其他标签页');
            resolve({ error: 'blocked' });
        };
    });
}

async function reimportDict() {
    console.log('========== 开始重新导入词典 ==========');

    try {
        // 1. 清空数据库
        console.log('步骤 1/4: 清空旧数据...');
        await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase('StarVocabDictionaryDB');
            request.onsuccess = () => {
                console.log('  ✅ 数据库已清空');
                resolve();
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                console.log('  ⚠️ 删除被阻塞，继续尝试...');
                resolve();
            };
        });

        localStorage.removeItem('star_vocab_dict_version');

        // 2. 加载词典文件
        console.log('步骤 2/4: 加载词典文件...');
        const response = await fetch('/dict/common_2500.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`  ✅ 加载成功: ${data.length} 个词条`);

        // 3. 打开数据库
        console.log('步骤 3/4: 初始化数据库...');
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('StarVocabDictionaryDB', 3);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('  创建 Object Stores...');

                // 创建 entries store
                if (!db.objectStoreNames.contains('entries')) {
                    const store = db.createObjectStore('entries', { keyPath: 'id' });
                    store.createIndex('word', 'word', { unique: false });
                    store.createIndex('word_lower', 'word_lower', { unique: false });
                    store.createIndex('source', 'source', { unique: false });
                    store.createIndex('frequency', 'frequency', { unique: false });
                }

                // 其他 stores
                if (!db.objectStoreNames.contains('translation_queue')) {
                    db.createObjectStore('translation_queue', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('examples')) {
                    const store = db.createObjectStore('examples', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('word', 'word', { unique: false });
                }
                if (!db.objectStoreNames.contains('translation_tasks')) {
                    const store = db.createObjectStore('translation_tasks', { keyPath: 'id' });
                    store.createIndex('entry_id', 'entry_id', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('created_at', 'created_at', { unique: false });
                }
            };

            request.onsuccess = () => {
                console.log('  ✅ 数据库已初始化');
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });

        // 4. 导入数据
        console.log('步骤 4/4: 导入词条...');
        const tx = db.transaction(['entries'], 'readwrite');
        const store = tx.objectStore('entries');

        let saved = 0;
        let errors = 0;

        for (const item of data) {
            try {
                const word = item.word;
                const pos = item.pos || 'unknown';
                const id = `${word.toLowerCase()}_${pos}`;

                // 提取冠词和性别
                let article = '';
                let gender = '';
                if (item.article && pos === 'noun') {
                    const art = item.article.toLowerCase();
                    const mapping = {
                        'der': { article: 'der', gender: 'm' },
                        'die': { article: 'die', gender: 'f' },
                        'das': { article: 'das', gender: 'n' }
                    };
                    if (mapping[art]) {
                        article = mapping[art].article;
                        gender = mapping[art].gender;
                    }
                }

                const entry = {
                    id: id,
                    word: word,
                    word_lower: word.toLowerCase(),
                    pos: pos,
                    article: article,
                    gender: gender,
                    plural: item.plural || '',
                    translation_cn: item.translation_cn || null,
                    translation_en: item.translation || null,
                    ipa: item.ipa || '',
                    audio_url: item.audio || '',
                    examples: item.example_de ? [{
                        de: item.example_de,
                        cn: item.example_cn || '',
                        source: 'wikt_2500'
                    }] : [],
                    rank: item.rank || null,
                    sources: [{ type: 'wiktionary', id: 'wikt_2500', imported_at: Date.now() }],
                    has_chinese: !!item.translation_cn,
                    translation_status: item.translation_cn ? 'complete' : 'pending',
                    created_at: Date.now(),
                    updated_at: Date.now()
                };

                store.put(entry);
                saved++;

                if (saved % 1000 === 0) {
                    console.log(`  进度: ${saved}/${data.length}`);
                }
            } catch (e) {
                errors++;
            }
        }

        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        console.log(`  ✅ 导入完成: ${saved} 成功, ${errors} 失败`);

        // 5. 保存版本号
        localStorage.setItem('star_vocab_dict_version', '2.0.1');

        db.close();

        console.log('\n✅ 词典导入成功！');
        console.log('   运行 checkDict() 验证结果');
        console.log('=====================================');

        return { success: true, saved, errors };

    } catch (error) {
        console.error('❌ 导入失败:', error);
        return { success: false, error: error.message };
    }
}

// 导出到全局
window.checkDict = checkDict;
window.reimportDict = reimportDict;

console.log('词典检查工具已加载！');
console.log('');
console.log('可用命令:');
console.log('  checkDict()     - 检查词典状态');
console.log('  reimportDict()  - 重新导入词典');
console.log('');
