using Builder.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Builder.Api.Data;

public sealed class BuilderDbContext(DbContextOptions<BuilderDbContext> options) : DbContext(options)
{
    public DbSet<Page> Pages => Set<Page>();
    public DbSet<CustomBlock> CustomBlocks => Set<CustomBlock>();
    public DbSet<FormSubmission> FormSubmissions => Set<FormSubmission>();
    public DbSet<TableDefinition> TableDefinitions => Set<TableDefinition>();
    public DbSet<TableRelation> TableRelations => Set<TableRelation>();
    public DbSet<DynamicRow> DynamicRows => Set<DynamicRow>();
    public DbSet<DynamicRelationRow> DynamicRelationRows => Set<DynamicRelationRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Page>(entity =>
        {
            entity.ToTable("Pages");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).HasMaxLength(128);
            entity.Property(p => p.Title).HasMaxLength(256);
            entity.Property(p => p.Slug).HasMaxLength(256);
            entity.Property(p => p.DraftJson).HasColumnType("nvarchar(max)");
            entity.Property(p => p.PublishedJson).HasColumnType("nvarchar(max)");
            entity.Property(p => p.DataSourceMapJson).HasColumnType("nvarchar(max)");
            entity.Property(p => p.RazorTemplate).HasColumnType("nvarchar(max)");
            entity.Property(p => p.CompiledAssemblyBytes).HasColumnType("varbinary(max)");
            entity.HasIndex(p => p.Slug).IsUnique();
        });

        modelBuilder.Entity<CustomBlock>(entity =>
        {
            entity.ToTable("CustomBlocks");
            entity.HasKey(b => b.Id);
            entity.Property(b => b.Name).HasMaxLength(180);
            entity.Property(b => b.Kind).HasMaxLength(32);
            entity.Property(b => b.ComponentType).HasMaxLength(80);
            entity.Property(b => b.DataJson).HasColumnType("nvarchar(max)");
            entity.HasIndex(b => new { b.Kind, b.Name });
        });

        modelBuilder.Entity<FormSubmission>(entity =>
        {
            entity.ToTable("FormSubmissions");
            entity.HasKey(s => s.Id);
            entity.Property(s => s.PageId).HasMaxLength(128);
            entity.Property(s => s.PageSlug).HasMaxLength(256);
            entity.Property(s => s.FormId).HasMaxLength(128);
            entity.Property(s => s.FormTitle).HasMaxLength(256);
            entity.Property(s => s.PayloadJson).HasColumnType("nvarchar(max)");
            entity.Property(s => s.RelayStatus).HasMaxLength(64);
            entity.HasIndex(s => new { s.PageId, s.FormId, s.CreatedAt });
            entity.HasIndex(s => s.CreatedAt);
        });

        modelBuilder.Entity<TableDefinition>(entity =>
        {
            entity.ToTable("TableDefinitions");
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Name).HasMaxLength(128);
            entity.Property(t => t.DisplayName).HasMaxLength(256);
            entity.Property(t => t.ColumnsJson).HasColumnType("nvarchar(max)");
            entity.HasIndex(t => t.Name).IsUnique();
            entity.HasMany(t => t.RelationsFrom)
                  .WithOne(r => r.FromTable)
                  .HasForeignKey(r => r.FromTableId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(t => t.RelationsTo)
                  .WithOne(r => r.ToTable)
                  .HasForeignKey(r => r.ToTableId)
                  .OnDelete(DeleteBehavior.NoAction);
            entity.HasMany(t => t.Rows)
                  .WithOne(r => r.Table)
                  .HasForeignKey(r => r.TableId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TableRelation>(entity =>
        {
            entity.ToTable("TableRelations");
            entity.HasKey(r => r.Id);
            entity.Property(r => r.RelationType).HasMaxLength(32);
            entity.Property(r => r.DisplayName).HasMaxLength(256);
            entity.HasMany(r => r.JunctionRows)
                  .WithOne(jr => jr.Relation)
                  .HasForeignKey(jr => jr.RelationId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DynamicRow>(entity =>
        {
            entity.ToTable("DynamicRows");
            entity.HasKey(r => r.Id);
            entity.Property(r => r.DataJson).HasColumnType("nvarchar(max)");
            entity.HasIndex(r => new { r.TableId, r.CreatedAt });
        });

        modelBuilder.Entity<DynamicRelationRow>(entity =>
        {
            entity.ToTable("DynamicRelationRows");
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => new { r.RelationId, r.FromRowId });
            entity.HasIndex(r => new { r.RelationId, r.ToRowId });
        });
    }
}
