package com.elearning.payment.vnpay;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;

@Component
public class VnpayGateway {

    private static final ZoneOffset ZONE = ZoneOffset.ofHours(7);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern(
        "uuuuMMddHHmmss"
    ).withResolverStyle(ResolverStyle.STRICT);
    private final VnpayProperties properties;

    public VnpayGateway(VnpayProperties properties) {
        this.properties = properties;
    }

    public boolean isAvailable() {
        return properties.isAvailable();
    }

    public int expireMinutes() {
        return properties.getExpireMinutes();
    }

    public void requireAvailable() {
        if (!isAvailable()) throw new AppException(ErrorCode.VNPAY_UNAVAILABLE);
    }

    public String createUrl(CourseOrder order, String clientIp) {
        requireAvailable();
        if (!"VND".equals(order.getCurrency())) throw new AppException(ErrorCode.BAD_REQUEST);
        String amount = minorAmount(order.getTotalAmount());
        if (!amount.matches("[0-9]{1,12}") || order.getTotalAmount().signum() <= 0) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        Map<String, String> fields = new TreeMap<>();
        fields.put("vnp_Version", "2.1.0");
        fields.put("vnp_Command", "pay");
        fields.put("vnp_TmnCode", properties.getTmnCode());
        fields.put("vnp_Amount", amount);
        fields.put("vnp_CurrCode", "VND");
        fields.put("vnp_TxnRef", order.getOrderCode());
        fields.put("vnp_OrderInfo", "Thanh toan khoa hoc " + order.getOrderCode());
        fields.put("vnp_OrderType", "other");
        fields.put("vnp_Locale", "vn");
        fields.put("vnp_IpAddr", clientIp);
        fields.put("vnp_ReturnUrl", properties.getReturnUrl().toString());
        fields.put("vnp_CreateDate", DATE.format(order.getCreatedAt().atOffset(ZONE)));
        fields.put("vnp_ExpireDate", DATE.format(order.getExpiresAt().atOffset(ZONE)));
        String query = canonical(fields);
        return properties.getPaymentUrl() + "?" + query + "&vnp_SecureHash=" + sign(query);
    }

    public Callback verify(MultiValueMap<String, String> parameters) {
        if (!isAvailable() || parameters.size() > 40) throw new InvalidCallback("97");
        Map<String, String> fields = new TreeMap<>();
        parameters.forEach((name, values) -> {
            if (!name.startsWith("vnp_")) return;
            if (
                !name.matches("vnp_[A-Za-z]+") ||
                values.size() != 1 ||
                values.getFirst() == null ||
                values.getFirst().length() > 1024
            ) {
                throw new InvalidCallback("97");
            }
            fields.put(name, values.getFirst());
        });
        String signature = fields.remove("vnp_SecureHash");
        fields.remove("vnp_SecureHashType");
        if (
            signature == null ||
            !signature.matches("[a-fA-F0-9]{128}") ||
            !MessageDigest.isEqual(
                HexFormat.of().parseHex(signature),
                HexFormat.of().parseHex(sign(canonical(fields)))
            )
        ) {
            throw new InvalidCallback("97");
        }
        if (!properties.getTmnCode().equals(fields.get("vnp_TmnCode"))) throw new InvalidCallback("01");
        String reference = fields.get("vnp_TxnRef");
        String amount = fields.get("vnp_Amount");
        String response = fields.get("vnp_ResponseCode");
        String status = fields.get("vnp_TransactionStatus");
        String transaction = fields.get("vnp_TransactionNo");
        if (reference == null || !reference.matches("LS-PAY-[A-Z0-9-]{1,33}")) throw new InvalidCallback(
            "01"
        );
        if (amount == null || !amount.matches("[0-9]{1,12}")) throw new InvalidCallback("04");
        if (fields.containsKey("vnp_CurrCode") && !"VND".equals(fields.get("vnp_CurrCode"))) {
            throw new InvalidCallback("04");
        }
        if (
            response == null ||
            !response.matches("[0-9]{2}") ||
            status == null ||
            !status.matches("[0-9]{2}") ||
            transaction == null ||
            !transaction.matches("[0-9]{1,15}")
        ) throw new InvalidCallback("99");
        PaymentStatus paymentStatus =
            "00".equals(response) && "00".equals(status)
                ? PaymentStatus.SUCCESS
                : "24".equals(response)
                  ? PaymentStatus.CANCELLED
                  : PaymentStatus.FAILED;
        Instant paidAt = null;
        if (paymentStatus == PaymentStatus.SUCCESS) {
            try {
                if (Long.parseLong(transaction) == 0) throw new IllegalArgumentException();
                paidAt = LocalDateTime.parse(fields.get("vnp_PayDate"), DATE).toInstant(ZONE);
            } catch (RuntimeException exception) {
                throw new InvalidCallback("99");
            }
        }
        return new Callback(
            reference,
            new BigDecimal(amount).movePointLeft(2),
            paymentStatus,
            transaction,
            response,
            paidAt
        );
    }

    public String resultUrl(String orderCode) {
        return properties.getResultUrl() + "?orderCode=" + encode(orderCode);
    }

    public String invalidReturnUrl() {
        return properties.getResultUrl() + "?callbackError=invalid";
    }

    public static String minorAmount(BigDecimal amount) {
        return amount.movePointRight(2).toBigIntegerExact().toString();
    }

    private String canonical(Map<String, String> fields) {
        return new TreeMap<>(fields)
            .entrySet()
            .stream()
            .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
            .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
            .collect(Collectors.joining("&"));
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(
                new SecretKeySpec(properties.getHashSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA512")
            );
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Cannot initialize payment signature");
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record Callback(
        String orderCode,
        BigDecimal amount,
        PaymentStatus status,
        String transactionCode,
        String responseCode,
        Instant paidAt
    ) {}

    public static class InvalidCallback extends RuntimeException {

        private final String responseCode;

        public InvalidCallback(String responseCode) {
            super("Payment callback rejected");
            this.responseCode = responseCode;
        }

        public String responseCode() {
            return responseCode;
        }
    }
}
