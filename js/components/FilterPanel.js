/**
 * FilterPanel Component
 * Componente Vue para panel de filtros avanzados del modo híbrido
 * Proporciona búsqueda multi-criterio, filtros por horario y disponibilidad,
 * presets de filtros y contador de resultados en tiempo real
 */

import FilterService from '../services/FilterService.js';

export default {
  name: 'FilterPanel',
  
  props: {
    subjects: {
      type: Array,
      default: () => []
    },
    courses: {
      type: Array,
      default: () => []
    },
    campuses: {
      type: Array,
      default: () => []
    },
    subjectCodes: {
      type: Array,
      default: () => []
    }
  },
  
  data() {
    return {
      // Filtros actuales
      filters: {
        text: '',
        subject: '',
        campus: '',
        schedule: {
          days: [],
          timeRange: { start: '', end: '' }
        },
        availability: 'all',
        professor: ''
      },
      
      // Estado del panel
      isExpanded: true,
      showPresets: false,
      showScheduleFilters: false,
      
      // Presets
      presets: [],
      newPresetName: '',
      showPresetForm: false,
      
      // Opciones de días
      dayOptions: [
        { value: 'monday', label: 'Lunes', short: 'L' },
        { value: 'tuesday', label: 'Martes', short: 'M' },
        { value: 'wednesday', label: 'Miércoles', short: 'W' },
        { value: 'thursday', label: 'Jueves', short: 'J' },
        { value: 'friday', label: 'Viernes', short: 'V' },
        { value: 'saturday', label: 'Sábado', short: 'S' },
        { value: 'sunday', label: 'Domingo', short: 'D' }
      ],
      
      // Opciones de disponibilidad
      availabilityOptions: [
        { value: 'all', label: 'Todas las secciones', icon: '📋' },
        { value: 'open', label: 'Solo secciones abiertas', icon: '✅' },
        { value: 'closed', label: 'Solo secciones cerradas', icon: '❌' }
      ],
      
      // Debounce timer para búsqueda
      searchDebounceTimer: null,
      
      // Resultados filtrados
      filteredResults: [],
      resultCount: 0
    };
  },
  
  computed: {
    /**
     * Cuenta el número de filtros activos
     */
    activeFiltersCount() {
      let count = 0;
      if (this.filters.text.trim()) count++;
      if (this.filters.subject.trim()) count++;
      if (this.filters.campus.trim()) count++;
      if (this.filters.availability !== 'all') count++;
      if (this.filters.professor.trim()) count++;
      if (this.filters.schedule.days.length > 0) count++;
      if (this.filters.schedule.timeRange.start && this.filters.schedule.timeRange.end) count++;
      return count;
    },
    
    /**
     * Verifica si hay filtros de horario activos
     */
    hasScheduleFilters() {
      return this.filters.schedule.days.length > 0 || 
             (this.filters.schedule.timeRange.start && this.filters.schedule.timeRange.end);
    },
    
    /**
     * Obtiene estadísticas de filtrado
     */
    filterStats() {
      return FilterService.getFilterStats(this.subjects, this.filteredResults);
    }
  },
  
  watch: {
    /**
     * Observa cambios en los filtros para aplicarlos automáticamente
     */
    filters: {
      handler(newFilters) {
        this.debouncedApplyFilters();
      },
      deep: true
    },
    
    /**
     * Observa cambios en los subjects para recalcular filtros
     */
    subjects: {
      handler() {
        this.applyFilters();
      },
      immediate: true
    }
  },
  
  mounted() {
    // Inicializar el servicio de filtros
    FilterService.init();
    
    // Cargar presets guardados
    this.loadPresets();
    
    // Aplicar filtros iniciales
    this.applyFilters();
  },
  
  methods: {
    /**
     * Aplica los filtros con debounce para optimizar rendimiento
     */
    debouncedApplyFilters() {
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      
      this.searchDebounceTimer = setTimeout(() => {
        this.applyFilters();
      }, 300);
    },
    
    /**
     * Aplica los filtros actuales a la lista de subjects
     */
    applyFilters() {
      // Actualizar filtros en el servicio
      FilterService.updateFilters(this.filters);
      
      // Aplicar filtros a los subjects
      this.filteredResults = this.filterSubjects(this.subjects);
      this.resultCount = this.filteredResults.length;
      
      // Emitir evento con resultados filtrados
      this.$emit('filters-applied', {
        filteredSubjects: this.filteredResults,
        filters: { ...this.filters },
        stats: this.filterStats
      });
    },
    
    /**
     * Filtra los subjects según los criterios actuales
     */
    filterSubjects(subjects) {
      if (!subjects || subjects.length === 0) return [];
      
      return subjects.filter(subject => {
        // Filtro por texto (código, nombre, título)
        if (this.filters.text.trim()) {
          const searchText = this.normalizeText(this.filters.text);
          const subjectCode = this.normalizeText(`${subject.subject}${subject.courseNumber}`);
          const subjectTitle = this.normalizeText(subject.courseTitle);
          
          if (!subjectCode.includes(searchText) && !subjectTitle.includes(searchText)) {
            return false;
          }
        }
        
        // Filtro por materia específica
        if (this.filters.subject && subject.subject !== this.filters.subject) {
          return false;
        }
        
        // Filtro por campus
        if (this.filters.campus) {
          const hasCoursesInCampus = this.courses.some(course => 
            course.subject === subject.subject && 
            course.courseNumber === subject.courseNumber &&
            course.campusDescription === this.filters.campus
          );
          
          if (!hasCoursesInCampus) {
            return false;
          }
        }
        
        // Filtro por disponibilidad
        if (this.filters.availability !== 'all') {
          const isOpen = this.filters.availability === 'open';
          const hasMatchingSections = subject.sections.some(section => section.openSection === isOpen);
          
          if (!hasMatchingSections) {
            return false;
          }
        }
        
        // Filtro por profesor
        if (this.filters.professor.trim()) {
          const professorFilter = this.normalizeText(this.filters.professor);
          const hasMatchingProfessor = subject.sections.some(section => 
            this.sectionHasProfessor(section, professorFilter)
          );
          
          if (!hasMatchingProfessor) {
            return false;
          }
        }
        
        // Filtro por horario
        if (this.hasScheduleFilters) {
          const hasMatchingSchedule = subject.sections.some(section => 
            this.sectionMatchesSchedule(section)
          );
          
          if (!hasMatchingSchedule) {
            return false;
          }
        }
        
        return true;
      });
    },
    
    /**
     * Normaliza texto para búsqueda
     */
    normalizeText(text) {
      if (!text) return '';
      return text.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    },
    
    /**
     * Verifica si una sección tiene un profesor específico
     */
    sectionHasProfessor(section, professorFilter) {
      if (!section.meetingsFaculty || !Array.isArray(section.meetingsFaculty)) {
        return false;
      }
      
      return section.meetingsFaculty.some(meeting => {
        if (!meeting.faculty || !Array.isArray(meeting.faculty)) {
          return false;
        }
        return meeting.faculty.some(faculty => 
          faculty.displayName && 
          this.normalizeText(faculty.displayName).includes(professorFilter)
        );
      });
    },
    
    /**
     * Verifica si una sección coincide con los filtros de horario
     */
    sectionMatchesSchedule(section) {
      if (!section.meetingsFaculty || !Array.isArray(section.meetingsFaculty)) {
        return false;
      }
      
      return section.meetingsFaculty.some(meeting => {
        if (!meeting.meetingTime) return false;
        
        // Verificar días si están especificados
        if (this.filters.schedule.days.length > 0) {
          const dayMapping = {
            'monday': meeting.meetingTime.monday,
            'tuesday': meeting.meetingTime.tuesday,
            'wednesday': meeting.meetingTime.wednesday,
            'thursday': meeting.meetingTime.thursday,
            'friday': meeting.meetingTime.friday,
            'saturday': meeting.meetingTime.saturday,
            'sunday': meeting.meetingTime.sunday
          };
          
          const hasMatchingDay = this.filters.schedule.days.some(day => dayMapping[day]);
          if (!hasMatchingDay) {
            return false;
          }
        }
        
        // Verificar rango de tiempo si está especificado
        if (this.filters.schedule.timeRange.start && this.filters.schedule.timeRange.end) {
          return this.timeInRange(
            meeting.meetingTime.beginTime,
            meeting.meetingTime.endTime,
            this.filters.schedule.timeRange.start,
            this.filters.schedule.timeRange.end
          );
        }
        
        return true;
      });
    },
    
    /**
     * Verifica si un horario está dentro del rango especificado
     */
    timeInRange(beginTime, endTime, rangeStart, rangeEnd) {
      if (!beginTime || !endTime) return false;
      
      const toMinutes = timeStr => {
        if (!timeStr) return 0;
        const hours = parseInt(timeStr.substring(0, 2), 10);
        const minutes = parseInt(timeStr.substring(2), 10);
        return hours * 60 + minutes;
      };
      
      const courseStart = toMinutes(beginTime);
      const courseEnd = toMinutes(endTime);
      const filterStart = toMinutes(rangeStart.replace(':', ''));
      const filterEnd = toMinutes(rangeEnd.replace(':', ''));
      
      // Verificar si hay superposición
      return (courseStart < filterEnd) && (filterStart < courseEnd);
    },
    
    /**
     * Limpia un filtro específico
     */
    clearFilter(filterName) {
      const defaultValues = {
        text: '',
        subject: '',
        campus: '',
        schedule: { days: [], timeRange: { start: '', end: '' } },
        availability: 'all',
        professor: ''
      };
      
      if (defaultValues.hasOwnProperty(filterName)) {
        this.filters[filterName] = defaultValues[filterName];
      }
    },
    
    /**
     * Limpia todos los filtros
     */
    clearAllFilters() {
      this.filters = {
        text: '',
        subject: '',
        campus: '',
        schedule: { days: [], timeRange: { start: '', end: '' } },
        availability: 'all',
        professor: ''
      };
    },
    
    /**
     * Alterna la selección de un día
     */
    toggleDay(day) {
      const index = this.filters.schedule.days.indexOf(day);
      if (index >= 0) {
        this.filters.schedule.days.splice(index, 1);
      } else {
        this.filters.schedule.days.push(day);
      }
    },
    
    /**
     * Verifica si un día está seleccionado
     */
    isDaySelected(day) {
      return this.filters.schedule.days.includes(day);
    },
    
    /**
     * Guarda un nuevo preset
     */
    savePreset() {
      if (!this.newPresetName.trim()) return;
      
      const preset = FilterService.savePreset(this.newPresetName.trim(), this.filters);
      this.loadPresets();
      
      this.newPresetName = '';
      this.showPresetForm = false;
      
      this.$emit('preset-saved', preset);
    },
    
    /**
     * Carga un preset
     */
    loadPreset(preset) {
      FilterService.loadPreset(preset);
      this.filters = FilterService.getCurrentFilters();
      this.showPresets = false;
      
      this.$emit('preset-loaded', preset);
    },
    
    /**
     * Elimina un preset
     */
    deletePreset(presetId) {
      FilterService.deletePreset(presetId);
      this.loadPresets();
      
      this.$emit('preset-deleted', presetId);
    },
    
    /**
     * Carga los presets guardados
     */
    loadPresets() {
      this.presets = FilterService.getPresets();
    },
    
    /**
     * Alterna la expansión del panel
     */
    toggleExpansion() {
      this.isExpanded = !this.isExpanded;
    },
    
    /**
     * Alterna la visibilidad de los filtros de horario
     */
    toggleScheduleFilters() {
      this.showScheduleFilters = !this.showScheduleFilters;
    }
  },
  
  template: `
    <div class="filter-panel">
      <!-- Header del panel -->
      <div class="filter-panel__header" @click="toggleExpansion">
        <div class="filter-panel__title">
          <h3 class="m-0">
            🔍 Filtros Avanzados
            <span v-if="activeFiltersCount > 0" class="filter-count-badge">
              {{ activeFiltersCount }}
            </span>
          </h3>
          <div class="filter-panel__stats">
            <span class="result-count">
              {{ resultCount }} de {{ subjects.length }} materias
              <span v-if="filterStats.percentage < 100" class="percentage">
                ({{ filterStats.percentage }}%)
              </span>
            </span>
          </div>
        </div>
        <button class="filter-panel__toggle" :class="{ 'expanded': isExpanded }">
          {{ isExpanded ? '▼' : '▶' }}
        </button>
      </div>
      
      <!-- Contenido del panel (colapsible) -->
      <div v-show="isExpanded" class="filter-panel__content">
        
        <!-- Filtros básicos -->
        <div class="filter-section">
          <div class="row g-3">
            
            <!-- Búsqueda por texto -->
            <div class="col-md-4 col-lg-6">
              <label class="form-label fw-semibold">
                🔍 Búsqueda general:
              </label>
              <div class="input-group">
                <input 
                  v-model="filters.text"
                  type="text" 
                  class="form-control filter-input" 
                  placeholder="Buscar por código, nombre o título..."
                >
                <button 
                  v-if="filters.text"
                  @click="clearFilter('text')"
                  class="btn btn-outline-secondary"
                  type="button"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <!-- Filtro por departamento -->
            <div class="col-md-4 col-lg-3">
              <label class="form-label fw-semibold text-truncate">
                🏛️ Depto:
              </label>
              <div class="input-group">
                <select v-model="filters.subject" class="form-select filter-select">
                  <option value="">Todos</option>
                  <option v-for="code in subjectCodes" :key="code" :value="code">
                    {{ code }}
                  </option>
                </select>
                <button 
                  v-if="filters.subject"
                  @click="clearFilter('subject')"
                  class="btn btn-outline-secondary"
                  type="button"
                  title="Limpiar departamento"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <!-- Filtro por campus -->
            <div class="col-md-4 col-lg-3">
              <label class="form-label fw-semibold">
                🏢 Sede:
              </label>
              <div class="input-group">
                <select v-model="filters.campus" class="form-select filter-select">
                  <option value="">Todas</option>
                  <option v-for="campus in campuses" :key="campus" :value="campus">
                    {{ campus }}
                  </option>
                </select>
                <button 
                  v-if="filters.campus"
                  @click="clearFilter('campus')"
                  class="btn btn-outline-secondary"
                  type="button"
                  title="Limpiar sede"
                >
                  ✕
                </button>
              </div>
            </div>
            
          </div>
        </div>
        
        <!-- Filtros avanzados -->
        <div class="filter-section">
          <div class="row g-3">
            
            <!-- Filtro por profesor -->
            <div class="col-md-6">
              <label class="form-label fw-semibold">
                👨‍🏫 Profesor:
              </label>
              <div class="input-group">
                <input 
                  v-model="filters.professor"
                  type="text" 
                  class="form-control filter-input" 
                  placeholder="Buscar por nombre del profesor..."
                >
                <button 
                  v-if="filters.professor"
                  @click="clearFilter('professor')"
                  class="btn btn-outline-secondary"
                  type="button"
                  title="Limpiar profesor"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <!-- Filtro por disponibilidad -->
            <div class="col-md-6">
              <label class="form-label fw-semibold">
                📊 Disponibilidad:
              </label>
              <div class="availability-options">
                <div 
                  v-for="option in availabilityOptions" 
                  :key="option.value"
                  class="availability-option"
                  :class="{ 'active': filters.availability === option.value }"
                  @click="filters.availability = option.value"
                >
                  <span class="availability-icon">{{ option.icon }}</span>
                  <span class="availability-label">{{ option.label }}</span>
                </div>
              </div>
            </div>
            
          </div>
        </div>
        
        <!-- Filtros de horario (Oculto temporalmente) -->
        <div v-if="false" class="filter-section">
          <div class="schedule-filter-header" @click="toggleScheduleFilters">
            <h4 class="schedule-filter-title">
              ⏰ Filtros de Horario
              <span v-if="hasScheduleFilters" class="schedule-active-indicator">●</span>
            </h4>
            <button class="schedule-filter-toggle" :class="{ 'expanded': showScheduleFilters }">
              {{ showScheduleFilters ? '▼' : '▶' }}
            </button>
          </div>
          
          <div v-show="showScheduleFilters" class="schedule-filter-content">
            
            <!-- Selección de días -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Días de la semana:</label>
              <div class="day-selector">
                <button
                  v-for="day in dayOptions"
                  :key="day.value"
                  @click="toggleDay(day.value)"
                  class="day-button"
                  :class="{ 'active': isDaySelected(day.value) }"
                  :title="day.label"
                >
                  {{ day.short }}
                </button>
              </div>
              <small class="text-muted">
                Selecciona los días en los que quieres que se dicten las clases
              </small>
            </div>
            
            <!-- Rango de tiempo -->
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label fw-semibold">Hora de inicio:</label>
                <input 
                  v-model="filters.schedule.timeRange.start"
                  type="time" 
                  class="form-control filter-input"
                >
              </div>
              <div class="col-md-6">
                <label class="form-label fw-semibold">Hora de fin:</label>
                <input 
                  v-model="filters.schedule.timeRange.end"
                  type="time" 
                  class="form-control filter-input"
                >
              </div>
            </div>
            
            <!-- Botón para limpiar filtros de horario -->
            <div class="mt-3" v-if="hasScheduleFilters">
              <button 
                @click="clearFilter('schedule')"
                class="btn btn-outline-warning btn-sm"
              >
                🗑️ Limpiar filtros de horario
              </button>
            </div>
            
          </div>
        </div>
        
        <!-- Acciones del panel -->
        <div class="filter-panel__actions">
          <div class="d-flex justify-content-between align-items-center">
            
            <!-- Botones de acción principales -->
            <div class="action-buttons">
              <button 
                @click="clearAllFilters"
                class="btn btn-outline-secondary"
                :disabled="activeFiltersCount === 0"
              >
                🗑️ Limpiar todo
              </button>
              
              <button 
                @click="showPresets = !showPresets"
                class="btn btn-outline-info"
              >
                💾 Presets
                <span v-if="presets.length > 0" class="badge bg-info ms-1">
                  {{ presets.length }}
                </span>
              </button>
            </div>
            
            <!-- Estadísticas de filtrado -->
            <div class="filter-stats">
              <span class="stats-text">
                Mostrando {{ resultCount }} de {{ subjects.length }} materias
              </span>
              <div class="stats-bar">
                <div 
                  class="stats-fill" 
                  :style="{ width: filterStats.percentage + '%' }"
                ></div>
              </div>
            </div>
            
          </div>
        </div>
        
        <!-- Panel de presets -->
        <div v-show="showPresets" class="presets-panel">
          <div class="presets-header">
            <h5 class="m-0">💾 Presets de Filtros</h5>
            <button 
              @click="showPresetForm = !showPresetForm"
              class="btn btn-sm btn-outline-primary"
            >
              ➕ Nuevo
            </button>
          </div>
          
          <!-- Formulario para nuevo preset -->
          <div v-show="showPresetForm" class="preset-form">
            <div class="input-group">
              <input 
                v-model="newPresetName"
                type="text" 
                class="form-control" 
                placeholder="Nombre del preset..."
                @keyup.enter="savePreset"
              >
              <button 
                @click="savePreset"
                class="btn btn-primary"
                :disabled="!newPresetName.trim()"
              >
                Guardar
              </button>
              <button 
                @click="showPresetForm = false; newPresetName = ''"
                class="btn btn-outline-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
          
          <!-- Lista de presets -->
          <div class="presets-list">
            <div v-if="presets.length === 0" class="empty-presets">
              <p class="text-muted mb-0">No hay presets guardados</p>
            </div>
            
            <div 
              v-for="preset in presets" 
              :key="preset.id"
              class="preset-item"
            >
              <div class="preset-info">
                <div class="preset-name">{{ preset.name }}</div>
                <div class="preset-meta">
                  Creado: {{ new Date(preset.createdAt).toLocaleDateString() }}
                </div>
              </div>
              <div class="preset-actions">
                <button 
                  @click="loadPreset(preset)"
                  class="btn btn-sm btn-outline-primary"
                  title="Cargar preset"
                >
                  📂
                </button>
                <button 
                  @click="deletePreset(preset.id)"
                  class="btn btn-sm btn-outline-danger"
                  title="Eliminar preset"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  `
};