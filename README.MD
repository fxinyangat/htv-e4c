htv-tagging/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app
│   │   ├── pipeline.py        # TaggingPipeline orchestrator
│   │   ├── classifier.py      # TaxonomyClassifier (KNN)
│   │   ├── llm.py             # LLM tagger
│   │   └── db.py              # DB connection + queries
│   ├── scripts/
│   │   ├── ingest_csv.py      # One-time: load CSV → companies table
│   │   ├── embed_batch.py     # One-time: generate embeddings
│   │   └── train_classifiers.py  # Train KNN from labeled data, save .joblib
│   ├── models/                # .joblib files (gitignored, uploaded to S3)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Queue.tsx      # The review queue — primary screen
│       │   └── Metrics.tsx    # Confidence + override rate charts
│       └── components/
│           └── CompanyCard.tsx
├── sql/
│   └── schema.sql             # Full schema with pgvector
└── .github/
    └── workflows/
        └── retrain.yml        # Trigger retraining on new labels
