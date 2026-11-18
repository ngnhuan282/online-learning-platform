package com.elearning.ai.service;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.common.exception.ErrorCode;
import com.elearning.ai.dto.MessageResponse;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class AiScopePolicy {

    private static final Pattern SUBJECT = Pattern.compile(
        "\\b(english|tieng anh|ngu phap|grammar|vocabulary|tu vung|phat am|pronunciation|" +
            "listening|speaking|reading|writing|luyen nghe|luyen noi|luyen doc|luyen viet|" +
            "dich|translate|translation|ielts|toeic|toefl|ipa|dictation|shadowing|" +
            "present perfect|present simple|present continuous|past tense|past simple|" +
            "thi hien tai|thi qua khu|thi tuong lai|dong tu|danh tu|tinh tu|trang tu|gioi tu|" +
            "verbs?|nouns?|adjectives?|adverbs?|prepositions?|idioms?|phrasal verbs?|" +
            "tenses?|articles?|pronouns?|conjunctions?|collocations?|synonyms?|antonyms?|" +
            "conditionals?|comparatives?|superlatives?|passive voice|reported speech|" +
            "chitchatgo|khoa hoc|bai hoc|lesson|course|quiz|transcript|" +
            "trang web|web nay|website|ung dung nay|" +
            "tai khoan|dang nhap|dang ky|mat khau|thanh toan|hoc phi|nang cap|goi pro|" +
            "membership|subscription|checkout|payment|enrollment|enrolment|" +
            "learning progress|account|login|password)\\b"
    );
    private static final Pattern LANGUAGE_TASK = Pattern.compile(
        "\\b(sua (cau|loi|doan)|correct (this|my|the) (sentence|text)|" +
            "what (does|do) .{1,80} mean|nghia (la gi|cua)|co nghia gi|" +
            "(?:a|an|the) (?:va|vs|and|or) (?:a|an|the)|when to use (?:a|an|the))\\b"
    );
    private static final Pattern PRO_HELP = Pattern.compile(
        "\\b((mua|gia han|kich hoat|quyen loi) pro|pro (co|la|gom|khac|het han|plan|membership)|" +
            "what is pro|pro\\?)\\b"
    );
    private static final Pattern LEARNING_CONTEXT = Pattern.compile(
        "\\b(english|tieng anh|grammar|ngu phap|vocabulary|tu vung|practice|luyen|" +
            "speaking|writing|pronunciation|phat am|ielts|toeic|quiz)\\b"
    );
    private static final Pattern LEARNER_REPLY = Pattern.compile(
        "(?:[a-d1-5][.!]?|(?:(?:my )?answer|option|dap an|chon)(?: is| la)?[: ]+[a-d1-5][.!]?|" +
            "(?:i|we|he|she|they|it|you|my|our|his|her|their|yes|no)(?:'[a-z]{1,2})? [a-z0-9 ,.'!\\-]{1,480})"
    );
    private static final Pattern FOLLOW_UP = Pattern.compile(
        "(?:(?:ban |hay |vui long |please |can you |could you )*)" +
            "(?:giai thich (them|lai|ro hon|chi tiet hon)|cho (minh |toi )?(?:them )?(?:[1-5] )?vi du|" +
            "tiep tuc(?: phan con lai)?|noi ro hon|ngan gon hon|don gian hon|" +
            "explain (more|again|further)|give (me )?(more |[1-5] )?examples|" +
            "continue|go on|simplify (it|that)|why|tai sao)" +
            "(?: (nhe|nha|a|voi|minh|giup minh|please|thanks))*[.!?]*"
    );
    private static final Pattern OVERRIDE = Pattern.compile(
        "\\b(ignore (all |the |your |previous )*(instructions|rules|prompt)|" +
            "system prompt|developer message|jailbreak|bo qua (moi |cac )?(chi dan|huong dan|quy tac)|" +
            "quen (het |cac )?(chi dan|huong dan|quy tac))\\b"
    );

    public void requireSupported(String question, List<MessageResponse> history) {
        String text = normalized(question);
        if (OVERRIDE.matcher(text).find()) throw new AppException(ErrorCode.AI_OFF_TOPIC);
        if (direct(text)) return;
        if (LEARNER_REPLY.matcher(text).matches()) {
            for (int index = history.size() - 1; index >= 0; index--) {
                var message = history.get(index);
                if ("USER".equals(message.sender())) {
                    String previous = normalized(message.content());
                    if (OVERRIDE.matcher(previous).find()) break;
                    if (
                        LEARNING_CONTEXT.matcher(previous).find() || LANGUAGE_TASK.matcher(previous).find()
                    ) return;
                    if (
                        !FOLLOW_UP.matcher(previous).matches() && !LEARNER_REPLY.matcher(previous).matches()
                    ) break;
                }
            }
        }
        if (FOLLOW_UP.matcher(text).matches()) {
            // A short follow-up is allowed only after a recognized learning/site question.
            for (int index = history.size() - 1; index >= 0; index--) {
                var message = history.get(index);
                if ("USER".equals(message.sender())) {
                    String previous = normalized(message.content());
                    if (OVERRIDE.matcher(previous).find()) break;
                    if (direct(previous)) return;
                    if (!FOLLOW_UP.matcher(previous).matches()) break;
                }
            }
        }
        throw new AppException(ErrorCode.AI_OFF_TOPIC);
    }

    private boolean direct(String text) {
        return (
            SUBJECT.matcher(text).find() ||
            LANGUAGE_TASK.matcher(text).find() ||
            PRO_HELP.matcher(text).find()
        );
    }

    private String normalized(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('\u0111', 'd')
            .replace('\u2019', '\'')
            .replaceAll("\\s+", " ")
            .strip();
    }
}
