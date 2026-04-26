# Model Benchmark

Classification accuracy on the 80-example labeled eval set (`eval/test_set.yaml`).
Higher accuracy = fewer wrong classifications on real social media content.

_Last run: 2026-04-26 14:24 UTC_

---

## Overall Accuracy

| Model | Size | Min VRAM | Accuracy | Avg Latency/item |
|-------|------|:--------:|:--------:|:----------------:|
| `llama3.2:latest` | 2.0 GB | 4 GB | **98%** (78/80) | 1.5s |
| `llama3.1:8b` | 4.9 GB | 8 GB | **98%** (78/80) | 1.8s |
| `qwen2.5:14b-instruct-q4_K_M` | 9.0 GB | 12 GB | **98%** (78/80) | 2.6s |
| `mistral:7b-instruct` | 4.4 GB | 8 GB | **96%** (77/80) | 926ms |
| `gemma3:12b` | 8.1 GB | 12 GB | **96%** (77/80) | 2.9s |
| `qwen2.5:7b-instruct` | 4.7 GB | 8 GB | **92%** (74/80) | 1.8s |
| `dolphin-mistral:latest` | 4.1 GB | 8 GB | **92%** (74/80) | 1.1s |
| `qwen2.5:3b-instruct` | 1.9 GB | 4 GB | **84%** (67/80) | 1.8s |
| `phi3.5:latest` | 2.2 GB | 4 GB | **68%** (54/80) | 1.1s |
| `qwen2.5:1.5b-instruct` | 983 MB | CPU / Any | **61%** (49/80) | 2.0s |
| `gemma:2b-instruct` | 1.6 GB | 4 GB | **49%** (39/80) | 1.9s |

## Per-Intent Accuracy

Accuracy broken down by intent. Low scores highlight where a model struggles.

| Model | divisive | engagement_bait | fearmongering | genuine | hype | ragebait |
|-------|:---------:|:---------:|:---------:|:---------:|:---------:|:---------:|
| `llama3.2:latest` | 91% | 92% | 100% | 100% | 100% | 100% |
| `llama3.1:8b` | 100% | 83% | 100% | 100% | 100% | 100% |
| `qwen2.5:14b-instruct-q4_K_M` | 100% | 100% | 100% | 96% | 91% | 100% |
| `mistral:7b-instruct` | 100% | 83% | 100% | 100% | 100% | 92% |
| `gemma3:12b` | 100% | 100% | 100% | 91% | 100% | 92% |
| `qwen2.5:7b-instruct` | 91% | 75% | 100% | 100% | 91% | 92% |
| `dolphin-mistral:latest` | 100% | 83% | 100% | 100% | 100% | 69% |
| `qwen2.5:3b-instruct` | 91% | 33% | 100% | 96% | 100% | 77% |
| `phi3.5:latest` | 82% | 92% | 90% | 57% | 82% | 23% |
| `qwen2.5:1.5b-instruct` | 91% | 50% | 70% | 83% | 27% | 31% |
| `gemma:2b-instruct` | 82% | 67% | 60% | 57% | 18% | 8% |

---

## Min VRAM by Model Size

| Min VRAM | Models that fit |
|:--------:|----------------|
| CPU / Any | Models under 1 GB (run without a GPU) |
| 4 GB | Models up to ~3 GB |
| 8 GB | Models up to ~6.5 GB |
| 12 GB | Models up to ~11 GB (gemma3:12b, phi4, qwen2.5:14b) |
| 16 GB | Models up to ~18 GB |

> Run `python scripts/benchmark.py` to regenerate this table with your own models.
