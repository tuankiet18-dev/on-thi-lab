# Codex + Antigravity Pipeline Status & Pause Snapshot

> **Status:** PAUSED (Tạm dừng)  
> **Lý do:** Gián đoạn do Codex API / Quota hết hạn khi đang thực thi.  
> **Chế độ làm việc hiện tại:** Chuyển sang tương tác & phát triển trực tiếp với Antigravity (Direct Pair-Programming Mode), tạm bỏ qua quy trình ủy quyền bắt buộc của Codex.

---

## 1. Tóm tắt kiến trúc Pipeline đã xây dựng

Pipeline được thiết kế theo mô hình **Codex (Orchestrator/Reviewer) -> Antigravity (Implementation Worker)**:

```
[User / Issue]
       │
       ▼
[Codex Triage & Planning] ──► Tạo Task Contract (`.agent/tasks/TASK-*.json`)
       │
       ▼
[Worktree Isolation] ───────► `scripts/create-agent-worktree.sh` (tạo branch `codex/<task-id>`)
       │
       ▼
[Antigravity Execution] ────► `scripts/delegate-to-agy.sh` (chạy AGY với ngân sách & permissions)
       │
       ▼
[Deterministic Gate] ───────► `scripts/review-agent-run.sh` (kiểm tra scope, lint, test, patch)
       │
       ▼
[Codex Review & Signoff] ───► `scripts/record-codex-review.sh` (ghi attestation PASS/FAIL)
       │
       ▼
[Single Commit to Main] ────► `scripts/approve-and-commit.sh` (tạo 1 commit duy nhất + attestation)
```

---

## 2. Trạng thái hiện tại của Codebase khi tạm dừng

### Uncommitted / Work-in-Progress Changes:

1. **`scripts/review-agent-run.sh`**:
   - Sửa dòng tính `diff_stat` sang `git apply --stat "$patch_file"` để nhận diện đúng cả các file mới/untracked.
2. **`scripts/tests/agent-pipeline.test.sh`**:
   - Bổ sung assertion kiểm tra `diffStat` không rỗng khi có file untracked.
   - Bổ sung assertion kiểm tra `node_modules` không bị lọt vào `git status` của worktree.
3. **`.gitignore`**:
   - Chuẩn hoá entry `node_modules`.
4. **`.agent/tasks/TASK-PIPELINE-SMOKE.json`**:
   - Task contract L0 dùng để kiểm thử smoke test end-to-end với AGY thực tế.
5. **Worktree tồn tại**:
   - `/home/kiet/code/project-worktrees/task-pipeline-smoke-real` (branch `codex/task-pipeline-smoke`).

---

## 3. Hướng dẫn tiếp tục (Resume Guide khi có lại Quota)

Khi quota của Codex đã sẵn sàng, thực hiện các bước sau để hoàn tất và kiểm thử pipeline:

1. **Kiểm tra suite test giả lập:**
   ```bash
   pnpm agent:test
   ```
2. **Chạy thử nghiệm smoke test thực tế:**
   ```bash
   # 1. Tạo worktree mới cho smoke test
   scripts/create-agent-worktree.sh .agent/tasks/TASK-PIPELINE-SMOKE.json origin/main

   # 2. Chuyển vào worktree và ủy quyền cho Antigravity thực thi
   cd /home/kiet/code/project-worktrees/TASK-PIPELINE-SMOKE
   scripts/delegate-to-agy.sh .agent/tasks/TASK-PIPELINE-SMOKE.json

   # 3. Chạy gate kiểm tra bằng chứng
   scripts/review-agent-run.sh .agent/tasks/TASK-PIPELINE-SMOKE.json

   # 4. Codex review & duyệt
   scripts/record-codex-review.sh .agent/tasks/TASK-PIPELINE-SMOKE.json --verdict PASS

   # 5. Commit và merge
   scripts/approve-and-commit.sh .agent/tasks/TASK-PIPELINE-SMOKE.json "docs(agent): verify real pipeline smoke test"
   ```

---

## 4. Chế độ phát triển tạm thời (Direct Mode với Antigravity)

Trong thời gian tạm bỏ qua pipeline:

- **Tương tác trực tiếp:** Bạn có thể yêu cầu Antigravity trực tiếp code, refactor, thêm tính năng hoặc debug bất kỳ phần nào trong `apps/`, `packages/`, `infra/`.
- **Quy trình chuẩn bị & kiểm tra:** Sử dụng `pnpm validate` hoặc chạy kiểm thử trực tiếp cho từng package/app.
- **Commit/Git:** Quản lý commit qua git thông thường như quy trình pair-programming tiêu chuẩn.
