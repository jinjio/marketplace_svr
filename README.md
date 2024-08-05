# PM 배포설정

```
pm2 ecosystem
# 적당히 내용 채우고
pm2 setup
# 이걸 하면 에러가 날건데
# package.json의   "type": "module" 을   "type": "commonjs" 로 바꾸고, 
# ecosystem.config.cjs라면 ecosystem.config.js로 고치고, 
# pm2 가 ES6 모듈을 지원하지 않아서 생기는 문제

```

# Unit Test 추가


vitest 설치, 아니면 유명한 jest 설치
```
yarn add vitest -D
```

test 설정을 조정할 config 파일 추가(있는게 좋음)
```
// vitest.config.js 를 프로젝트 폴더에 생성하고 아래 입력
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // ... Specify options here.
    testTimeout: 10000,
  },
})
```
vscode에서 디버깅을 위한 launch.json에 실행 추가
```
    {
      "type": "node",
      "request": "launch",
      "name": "Run ViTest",
      "program": "${workspaceFolder}/node_modules/vitest/dist/cli.js",
      "args": [
        // "test",
        "--config",
        "${workspaceFolder}/vitest.config.js"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
```

