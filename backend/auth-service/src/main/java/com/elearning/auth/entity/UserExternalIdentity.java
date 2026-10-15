package com.elearning.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;

@Entity
@Table(name = "user_external_identities")
@Getter
public class UserExternalIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String provider;

    @Convert(converter = ProviderSubjectConverter.class)
    @Column(name = "provider_subject", nullable = false, length = 255)
    private String providerSubject;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "linked_at", nullable = false)
    private Instant linkedAt;

    protected UserExternalIdentity() {}

    public UserExternalIdentity(User user, String subject, String email) {
        this.user = user;
        this.provider = "GOOGLE";
        this.providerSubject = subject;
        this.email = email;
        this.linkedAt = Instant.now();
    }
}
