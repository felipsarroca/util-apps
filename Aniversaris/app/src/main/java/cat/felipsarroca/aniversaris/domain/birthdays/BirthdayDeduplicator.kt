package cat.felipsarroca.aniversaris.domain.birthdays

object BirthdayDeduplicator {
    data class Result(val birthdays: List<ParsedBirthday>, val invalidRows: Int, val duplicatesRemoved: Int)

    fun process(rows: List<RawBirthday>): Result {
        val invalid = rows.filter { BirthdayNormalizer.parseDate(it.rawDate) == null }
        val candidates = rows.mapNotNull { row ->
            BirthdayNormalizer.parseDate(row.rawDate)?.let { date -> Candidate(row, date) }
        }
        val groups = mutableListOf<MutableList<Candidate>>()
        candidates.sortedBy { it.row.sourceRowId }.forEach { candidate ->
            val existing = groups.firstOrNull { group -> group.any { shouldMerge(it, candidate) } }
            if (existing == null) groups += mutableListOf(candidate) else existing += candidate
        }
        val merged = groups.map(::merge)
        return Result(merged, invalid.size, candidates.size - merged.size)
    }

    private data class Candidate(val row: RawBirthday, val date: BirthdayNormalizer.DateParts)

    private fun shouldMerge(a: Candidate, b: Candidate): Boolean {
        if (a.row.accountName != b.row.accountName || a.row.accountType != b.row.accountType) return false
        if (a.date.day != b.date.day || a.date.month != b.date.month) return false
        if (a.row.sourceRowId == b.row.sourceRowId) return true
        val sameContact = a.row.contactId != null && a.row.contactId == b.row.contactId
        val sameLookup = !a.row.lookupKey.isNullOrBlank() && a.row.lookupKey == b.row.lookupKey
        if (sameContact || sameLookup) return true
        if (BirthdayNormalizer.normalizeName(a.row.displayName) != BirthdayNormalizer.normalizeName(b.row.displayName)) return false
        if (a.date.year != null && b.date.year != null) return a.date.year == b.date.year
        return true
    }

    private fun merge(group: List<Candidate>): ParsedBirthday {
        val preferred = group.maxWith(compareBy<Candidate> { it.row.displayName.length }.thenBy { -it.row.sourceRowId })
        val years = group.mapNotNull { it.date.year }.distinct()
        return ParsedBirthday(
            sourceRowIds = group.map { it.row.sourceRowId }.toSet(),
            rawContactIds = group.map { it.row.rawContactId }.toSet(),
            contactIds = group.mapNotNull { it.row.contactId }.toSet(),
            lookupKeys = group.mapNotNull { it.row.lookupKey }.toSet(),
            displayName = BirthdayNormalizer.normalizeSpaces(preferred.row.displayName),
            normalizedName = BirthdayNormalizer.normalizeName(preferred.row.displayName),
            day = preferred.date.day,
            month = preferred.date.month,
            birthYear = years.singleOrNull(),
            hasYearConflict = years.size > 1,
            photoThumbnailUri = group.firstNotNullOfOrNull { it.row.photoThumbnailUri },
            accountName = preferred.row.accountName,
            accountType = preferred.row.accountType,
        )
    }
}
