package com.elearning.auth.entity;

import com.elearning.auth.entity.enums.UserStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
@Getter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 60)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private UserStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToMany
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();

    protected User() {}

    public User(String email, String passwordHash, String fullName, Role role) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.status = UserStatus.ACTIVE;
        this.roles.add(role);
    }

    public void updateProfile(String fullName) {
        this.fullName = fullName;
    }

    public void updatePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void updateStatus(UserStatus status) {
        this.status = status;
    }

    public void setRoles(Set<Role> roles) {
        this.roles = roles != null ? roles : new HashSet<>();
    }

    @PrePersist
    void created() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void updated() {
        updatedAt = Instant.now();
    }
}
