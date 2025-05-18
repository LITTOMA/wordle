document.addEventListener('DOMContentLoaded', () => {
    const WORD_LENGTH = 5;
    const MAX_GUESSES = 6;
    let currentGuess = [];
    let currentRow = 0;
    let targetWord = ''; // This will be the string form of the word
    let targetWordObject = null; // This will hold the {word, definition_zh, pos} object
    let isGameOver = false;
    let fullWordData = []; // To store the loaded word list with details
    let validWords = new Set(); // Declare validWords in a wider scope

    const gameBoard = document.getElementById('game-board');
    const keyboardContainer = document.getElementById('keyboard-container');
    const messageArea = document.getElementById('message-area');
    const restartButton = document.getElementById('restart-button');
    const customSubmitButton = document.getElementById('custom-submit-button');

    async function loadWordListAndStartGame() {
        try {
            const response = await fetch('wordlist_zh.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            fullWordData = await response.json();
            if (!fullWordData || fullWordData.length === 0) {
                console.error("Word list is empty or failed to load!");
                messageArea.textContent = "错误：无法加载词库！";
                return;
            }
            // Create validWords Set from the loaded fullWordData
            validWords = new Set(fullWordData.map(item => item.word.toLowerCase()));
            console.log("[INFO] Word list loaded and validWords set created.", validWords);

            initializeGame(); 
        } catch (error) {
            console.error("Failed to load word list:", error);
            messageArea.textContent = "错误：加载词库失败！";
        }
    }

    function initializeGame() {
        if (fullWordData.length === 0) {
            messageArea.textContent = "词库为空，无法开始游戏。";
            return; // Don't proceed if word list isn't loaded
        }
        targetWordObject = fullWordData[Math.floor(Math.random() * fullWordData.length)];
        targetWord = targetWordObject.word.toLowerCase(); 
        
        console.log("[NEW GAME] Target word (for testing):", targetWord, "Info:", targetWordObject);

        isGameOver = false;
        currentRow = 0;
        currentGuess = [];
        messageArea.textContent = '';
        restartButton.style.display = 'none';
        
        gameBoard.innerHTML = ''; // 清空旧的游戏板
        for (let i = 0; i < MAX_GUESSES; i++) {
            const row = document.createElement('div');
            row.className = 'row';
            for (let j = 0; j < WORD_LENGTH; j++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                row.appendChild(tile);
            }
            gameBoard.appendChild(row);
        }
        updateKeyboardAppearance();
    }

    function handleKeyPress(key) {
        if (isGameOver) return;

        key = key.toLowerCase();

        if (key === 'enter') {
            console.log(`[DEBUG] Enter pressed. currentGuess.length: ${currentGuess.length}, WORD_LENGTH: ${WORD_LENGTH}`);
            if (currentGuess.length === WORD_LENGTH) {
                console.log(`[DEBUG] Length matches. Calling submitGuess.`);
                submitGuess();
            } else {
                console.log(`[DEBUG] Length mismatch. Showing '单词长度不足'.`);
                showMessage("单词长度不足");
            }
        } else if (key === 'backspace') {
            if (currentGuess.length > 0) {
                currentGuess.pop();
                updateCurrentRowDisplay();
            }
        } else if (key.length === 1 && key >= 'a' && key <= 'z') {
            if (currentGuess.length < WORD_LENGTH) {
                currentGuess.push(key);
                updateCurrentRowDisplay();
            }
        }
    }

    function updateCurrentRowDisplay() {
        const rowElement = gameBoard.children[currentRow];
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = rowElement.children[i];
            tile.textContent = currentGuess[i] || '';
            if (currentGuess[i]) {
                tile.classList.add('pop'); // 添加pop动画
                setTimeout(() => tile.classList.remove('pop'), 100);
            } else {
                tile.classList.remove('pop');
            }
        }
    }

    function submitGuess() {
        // console.log(`[DEBUG] submitGuess entered. currentGuess at entry: ...`);

        const guessWord = currentGuess.join(''); 

        console.log(`[DEBUG] Evaluating guess. Target: "${targetWord}", Guess: "${guessWord}"`);

        if (validWords && !validWords.has(guessWord)) {
            showMessage("不是有效的单词");
            return;
        }

        const rowElement = gameBoard.children[currentRow];
        const letterCounts = {};
        for (let char of targetWord) {
            letterCounts[char] = (letterCounts[char] || 0) + 1;
        }

        const tempKeyboardStatus = {}; // 用于临时存储键盘按键状态

        // 第一次遍历：标记绿色（完全正确）并更新tempKeyboardStatus
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = rowElement.children[i];
            const letter = currentGuess[i];
            tile.classList.add('flip');

            if (letter === targetWord[i]) {
                tile.classList.add('correct');
                letterCounts[letter]--;
                tempKeyboardStatus[letter] = 'correct';
            }
        }
        
        // 第二次遍历：标记黄色（存在但位置不对）和灰色（不存在）的图块，并更新tempKeyboardStatus
        // console.log(`[DEBUG] After green pass. Target: "${targetWord}", Guess: "${guessWord}"`);
        // console.log(`[DEBUG] letterCounts after green pass:`, JSON.parse(JSON.stringify(letterCounts)));

        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = rowElement.children[i];
            const letter = currentGuess[i];

            // console.log(`[DEBUG] Tile ${i}, Letter: '${letter}'`);
            if (tile.classList.contains('correct')) {
                // console.log(`[DEBUG] ...already green, skipping.`);
                continue;
            } 

            const isInTarget = targetWord.includes(letter);
            const countForLetter = letterCounts[letter] || 0;
            // console.log(`[DEBUG] ...isInTarget: ${isInTarget}, countForLetter ('${letter}'): ${countForLetter}`);

            if (isInTarget && countForLetter > 0) {
                // console.log(`[DEBUG] ......Marking YELLOW (present)`);
                tile.classList.add('present');
                letterCounts[letter]--; 
                if (tempKeyboardStatus[letter] !== 'correct') {
                    tempKeyboardStatus[letter] = 'present';
                }
            } else {
                // console.log(`[DEBUG] ......Marking GRAY (absent)`);
                tile.classList.add('absent');
                // 此处的 tile 为 absent 不直接导致键盘按键为 absent
            }
        }

        // 根据收集到的信息更新键盘状态
        const uniqueGuessedLetters = new Set(currentGuess);
        for (const letter of uniqueGuessedLetters) {
            if (tempKeyboardStatus[letter] === 'correct') {
                updateKeyboardKey(letter, 'correct');
            } else if (tempKeyboardStatus[letter] === 'present') {
                updateKeyboardKey(letter, 'present');
            } else {
                // 如果字母在猜测中，但既不是 correct也不是 present
                // 检查它是否真的不在目标单词中
                if (!targetWord.includes(letter)) {
                    updateKeyboardKey(letter, 'absent');
                }
            }
        }

        if (guessWord === targetWord) {
            showMessage(`太棒了! 正确的单词是: ${targetWord.toUpperCase()} (${targetWordObject.definition_zh} [${targetWordObject.pos}])`);
            isGameOver = true;
            restartButton.style.display = 'block';
            return;
        }

        currentRow++;
        currentGuess = [];

        if (currentRow === MAX_GUESSES) {
            showMessage(`游戏结束，正确的单词是: ${targetWord.toUpperCase()} (${targetWordObject.definition_zh} [${targetWordObject.pos}])`);
            isGameOver = true;
            restartButton.style.display = 'block'; 
        }
    }

    function updateKeyboardKey(letter, status) {
        const keyElement = keyboardContainer.querySelector(`button[data-key="${letter.toLowerCase()}"]`);
        if (!keyElement) return;

        // 状态优先级: correct > present > (initial/absent)
        // 如果按键已为 'correct', 不做任何改变
        if (keyElement.classList.contains('correct')) {
            return;
        }
        // 如果按键已为 'present' 且新状态是 'absent', 不做任何改变
        if (keyElement.classList.contains('present') && status === 'absent') {
            return;
        }

        // 移除所有旧的Wordle状态并默认启用按键
        keyElement.classList.remove('correct', 'present', 'absent');
        keyElement.disabled = false;

        if (status === 'correct') {
            keyElement.classList.add('correct');
        } else if (status === 'present') {
            keyElement.classList.add('present');
        } else if (status === 'absent') {
            keyElement.classList.add('absent');
            keyElement.disabled = true; // 仅在确认字母不在目标单词中时禁用
        }
    }
    
    function updateKeyboardAppearance() {
        const allKeys = keyboardContainer.querySelectorAll('button[data-key]');
        allKeys.forEach(key => {
            key.classList.remove('correct', 'present', 'absent');
            key.disabled = false; // Ensure keys are re-enabled
        });
    }


    function showMessage(msg, duration = 3000) {
        messageArea.textContent = msg;
        if (duration > 0) {
            setTimeout(() => {
                if (messageArea.textContent === msg) { // 避免清除后续的消息
                    messageArea.textContent = '';
                }
            }, duration);
        }
    }

    // 物理键盘事件监听
    document.addEventListener('keydown', (e) => {
        handleKeyPress(e.key);
    });

    // 虚拟键盘事件监听
    keyboardContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const key = e.target.dataset.key;
            if (key && key !== 'enter') {
                handleKeyPress(key);
            }
        }
    });

    // Event listener for the new custom submit button
    customSubmitButton.addEventListener('click', () => {
        handleKeyPress('enter');
    });

    // Event listener for the restart button
    restartButton.addEventListener('click', initializeGame); // Restart button can directly call initializeGame as data is already loaded
    
    // Initialize game by loading the word list first
    loadWordListAndStartGame(); 
}); 