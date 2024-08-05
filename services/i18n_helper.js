/**
 * Created by jaekwon on 2017. 5. 11..
 */

let translation = {
    "sign_in_mail_title": {
        "en": "Sign in to ${site}",
        "ko": "${site}에 접속하세요",
    },
    "sign_in_mail_content": {
        "en": "<p>Enter login code(6 digit number). This code is valid in 10 minutes</p> <strong><pre>${code}</pre></strong> <p>Thanks</p> <p>${site} team</p>",
        "ko": "<p>로그인 코드(6자리 숫자)를 입력하세요. 10분간만 유효합니다.</p> <strong><pre>${code}</pre></strong> <p>감사합니다</p> <p>${site} 팀</p>",
    },
    "your_are_invited_group_title": {
        "en": "Your invited codingpen group (${room_name})",
        "ko": "챗토마타 그룹 (${room_name})에 초대되셨습니다."
    },
    "your_are_invited_group_content": {
        "en": "Please visit link below to accept ${group_name} group invitation",
        "ko": "${group_name} 그룹 초청을 수락하시려면 아래 링크를 방문해주세요"
    },
    "title": {
        "en": "ankichampion",
        "ko": "안키챔피언"
    },
    "invited": {
        "en": "Invited ${nickname}",
        "ko": "초대 완료하였습니다. ${nickname}"
    },
    "finished": {
        "en": "Finished",
        "ko": "완료했습니다"
    },
    "timeout": {
        "en": "Timeout",
        "ko": "시간 초과"
    },
    "execution_error": {
        "en": "Execution Error",
        "ko": "실행 에러"
    },
}

export default {
    getTranslation: function (key, lang) {
        if (lang == null)
            lang = 'ko'

        lang = lang.toLowerCase()
        lang = lang.substring(0, 2)
        // if (lang.indexOf('ko') != -1)
        //     lang = 'ko'

        try {
            let v = translation[key][lang]
            if (v == null) {
                return key
            }
            return v
        } catch (e) {
            return key
        }
    }
}