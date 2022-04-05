exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("users", {
    id: {
      type: "serial",
      notNull: true,
      primaryKey: true,
    },
    email: { type: "varchar(255)", notNull: true },
    password: { type: "varchar(255)", notNull: true },
    is_admin: { type: "boolean", notNull: true },
    active: { type: "boolean", notNull: true },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
  pgm.createTable("domains", {
    id: {
      type: "serial",
      notNull: true,
      primaryKey: true,
    },
    user_id: {
      type: "integer",
      notNull: true,
      references: '"users"',
      onDelete: "cascade",
    },
    name: { type: "varchar(255)", notNull: true },
    secret_key: { type: "varchar(255)", notNull: true },
    set_image: { type: "boolean", notNull: true },
  });
  pgm.createTable("jobs", {
    id: {
      type: "serial",
      notNull: true,
      primaryKey: true,
    },
    hash_id: { type: "varchar(255)", notNull: true },
    user_id: {
      type: "integer",
      notNull: true,
      references: '"users"',
      onDelete: "cascade",
    },
    domain_id: {
      type: "integer",
      notNull: true,
      references: '"domains"',
      onDelete: "cascade",
    },
    name: { type: "varchar(255)", notNull: true },
    category: { type: "varchar(255)", notNull: true },
    author: { type: "varchar(255)", notNull: true },
  });
  pgm.createTable("keywords", {
    id: {
      type: "serial",
      notNull: true,
      primaryKey: true,
    },
    user_id: {
      type: "integer",
      notNull: true,
      references: '"users"',
      onDelete: "cascade",
    },
    job_id: {
      type: "integer",
      notNull: true,
      references: '"jobs"',
      onDelete: "cascade",
    },
    name: { type: "varchar(255)", notNull: true },
    status: { type: "boolean", notNull: true },
  });

  pgm.sql(`INSERT INTO users (email, password, is_admin, active) VALUES
('adridder@gmail.com', '$2a$10$uAB8Jq5kOIsCtM26b5E0M.HikxWIsVUsMCV00mOHe0QUEgi6Eb/5a', true, true);`);
};

exports.down = (pgm) => {};
