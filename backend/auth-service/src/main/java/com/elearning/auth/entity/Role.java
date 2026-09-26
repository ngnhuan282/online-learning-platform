package com.elearning.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;

@Entity
@Table(name = "roles")
@Getter
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String name;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(length = 500)
    private String description;

    @Column(name = "system_role", nullable = false)
    private boolean systemRole;

    @Version
    private long version;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "role_permissions", joinColumns = @JoinColumn(name = "role_id"))
    @Column(name = "permission_code", nullable = false, length = 64)
    private Set<String> permissions = new HashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Role() {}

    public Role(String name, String label, String description, Set<String> permissions) {
        this.name = name;
        update(label, description, permissions);
    }

    public void update(String label, String description, Set<String> permissions) {
        this.label = label;
        this.description = description;
        this.permissions = new HashSet<>(permissions);
    }

    @PrePersist
    void created() {
        createdAt = Instant.now();
    }
}
