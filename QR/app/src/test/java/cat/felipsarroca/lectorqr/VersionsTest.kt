package cat.felipsarroca.lectorqr

import org.junit.Assert.*
import org.junit.Test

class VersionsTest {
    @Test fun comparesNumericComponents() {
        assertTrue(Versions.compare("v1.10.0", "1.9.0")!! > 0)
        assertEquals(0, Versions.compare("v1.0.0", "1.0.0"))
        assertTrue(Versions.compare("v1.0.0", "1.0.1")!! < 0)
    }
    @Test fun rejectsPrereleaseAndMalformedVersions() {
        assertNull(Versions.compare("v1.1.0-beta", "1.0.0"))
        assertNull(Versions.compare("latest", "1.0.0"))
    }
}
