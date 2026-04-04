import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260404153000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_available_extensions where name = 'vector') then
          execute 'create extension if not exists vector';
        end if;
      end
      $$;
    `)
    this.addSql(`
      alter table if exists "ai_config"
      add column if not exists "rag_enabled" boolean not null default true,
      add column if not exists "ragflow_enabled" boolean not null default false,
      add column if not exists "ragflow_base_url" text null,
      add column if not exists "ragflow_api_key" text null,
      add column if not exists "ragflow_knowledge_base_id" text null,
      add column if not exists "embedding_model" text not null default 'text-embedding-3-small',
      add column if not exists "embedding_dimensions" integer not null default 1536,
      add column if not exists "similarity_threshold" numeric not null default 0.7,
      add column if not exists "max_context_items" integer not null default 5,
      add column if not exists "embed_products" boolean not null default true,
      add column if not exists "embed_orders" boolean not null default false,
      add column if not exists "embed_policies" boolean not null default true,
      add column if not exists "embed_faqs" boolean not null default true,
      add column if not exists "upload_receipts" boolean not null default true,
      add column if not exists "upload_invoices" boolean not null default true,
      add column if not exists "upload_catalogs" boolean not null default false,
      add column if not exists "auto_embed_on_create" boolean not null default true,
      add column if not exists "auto_embed_on_update" boolean not null default true,
      add column if not exists "batch_embed_interval_hours" integer not null default 24,
      add column if not exists "cache_embeddings" boolean not null default true,
      add column if not exists "cache_ttl_hours" integer not null default 24,
      add column if not exists "max_embeddings_per_day" integer not null default 1000,
      add column if not exists "embeddings_today" integer not null default 0;
    `)
    this.addSql(`
      create table if not exists "ai_embeddings" (
        "id" text not null,
        "entity_type" text not null,
        "entity_id" text not null,
        "shop_id" text not null,
        "content_text" text not null,
        "content_metadata" jsonb null,
        "usage_count" integer not null default 0,
        "last_used_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "ai_embeddings_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_extension where extname = 'vector') then
          execute 'alter table "ai_embeddings" add column if not exists "embedding" vector(1536)';
        else
          execute 'alter table "ai_embeddings" add column if not exists "embedding_json" jsonb null';
        end if;
      end
      $$;
    `)
    this.addSql(`
      create index if not exists "idx_ai_embeddings_entity"
      on "ai_embeddings" ("entity_type", "entity_id");
    `)
    this.addSql(`
      create index if not exists "idx_ai_embeddings_shop"
      on "ai_embeddings" ("shop_id");
    `)
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_extension where extname = 'vector') then
          execute '
            create index if not exists "idx_ai_embeddings_vector"
            on "ai_embeddings" using ivfflat ("embedding" vector_cosine_ops)
            with (lists = 100)
          ';
          execute '
            create or replace function match_embeddings(
              query_embedding vector(1536),
              match_shop_id text default null,
              match_threshold float default 0.7,
              match_count int default 5
            )
            returns table (
              id text,
              entity_type text,
              entity_id text,
              shop_id text,
              content_text text,
              content_metadata jsonb,
              similarity float
            )
            language sql
            as $fn$
              select
                e.id,
                e.entity_type,
                e.entity_id,
                e.shop_id,
                e.content_text,
                e.content_metadata,
                1 - (e.embedding <=> query_embedding) as similarity
              from ai_embeddings e
              where
                (match_shop_id is null or e.shop_id = match_shop_id)
                and 1 - (e.embedding <=> query_embedding) >= match_threshold
              order by e.embedding <=> query_embedding
              limit match_count
            $fn$
          ';
        end if;
      end
      $$;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop function if exists match_embeddings(vector, text, float, int);`)
    this.addSql(`drop index if exists "idx_ai_embeddings_vector";`)
    this.addSql(`drop index if exists "idx_ai_embeddings_shop";`)
    this.addSql(`drop index if exists "idx_ai_embeddings_entity";`)
    this.addSql(`drop table if exists "ai_embeddings" cascade;`)
    this.addSql(`
      alter table if exists "ai_config"
      drop column if exists "rag_enabled",
      drop column if exists "ragflow_enabled",
      drop column if exists "ragflow_base_url",
      drop column if exists "ragflow_api_key",
      drop column if exists "ragflow_knowledge_base_id",
      drop column if exists "embedding_model",
      drop column if exists "embedding_dimensions",
      drop column if exists "similarity_threshold",
      drop column if exists "max_context_items",
      drop column if exists "embed_products",
      drop column if exists "embed_orders",
      drop column if exists "embed_policies",
      drop column if exists "embed_faqs",
      drop column if exists "upload_receipts",
      drop column if exists "upload_invoices",
      drop column if exists "upload_catalogs",
      drop column if exists "auto_embed_on_create",
      drop column if exists "auto_embed_on_update",
      drop column if exists "batch_embed_interval_hours",
      drop column if exists "cache_embeddings",
      drop column if exists "cache_ttl_hours",
      drop column if exists "max_embeddings_per_day",
      drop column if exists "embeddings_today";
    `)
  }
}
