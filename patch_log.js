const fs = require('fs');
let code = fs.readFileSync('workers/sms-api/src/index.js', 'utf8');

const targetStr = "const pushRes = await triggerAppPushCall(env, dispatchDeviceId, target.MOBILE_NO);";
const replaceStr = `const pushRes = await triggerAppPushCall(env, dispatchDeviceId, target.MOBILE_NO);
      try {
        await db.prepare("INSERT INTO TB_SCL_TEST_LOG (STRATEGY_ID, API_URL, API_METHOD, REQ_PARAMS, STATUS_CODE, RESPONSE_BODY, ELAPSED_MS, SUCCESS, TESTED_BY, TESTED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(strategy.STRATEGY_ID, 'AUTO_PUSH_TEST', 'PUSH', JSON.stringify({ dispatchDeviceId, mobile: target.MOBILE_NO }), pushRes.success ? 200 : 500, JSON.stringify(pushRes), 0, pushRes.success ? 'Y' : 'N', 'SYSTEM', getKst()).run();
      } catch (logErr) {
        console.error("Failed to log pushRes", logErr);
      }`;

if (code.includes(targetStr) && !code.includes('AUTO_PUSH_TEST')) {
  code = code.replace(targetStr, replaceStr);
  fs.writeFileSync('workers/sms-api/src/index.js', code);
  console.log("Patched workers/sms-api/src/index.js successfully");
} else {
  console.log("Already patched or target string not found");
}
