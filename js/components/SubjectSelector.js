import CourseService from '../services/CourseService.js';
import ScheduleGeneratorService from '../services/ScheduleGeneratorService.js';
import { decodeHtmlEntities } from '../utils/HtmlUtils.js';

export default {
  data() {
    return {
      courses: [],
      subjects: [],
      filteredSubjects: [],
      selectedSubjects: [],
      loading: true,
      error: null,
      filters: {
        subject: '',
        courseNumber: '',
        search: '',
      },
      subjectCodes: [],
      onlyOpenSections: true,
      generatingSchedules: false,
      generatedSchedules: null
    };
  },
  
  async mounted() {
    try {
      this.loading = true;
      // Cargamos todos los cursos
      this.courses = await CourseService.loadCourses();
      
      // Agrupamos por materia
      this.subjects = ScheduleGeneratorService.groupCoursesBySubject(this.courses);
      this.filteredSubjects = [...this.subjects];
      
      // Inicializamos filtros
      this.initializeFilters();
      
    } catch (error) {
      this.error = `Error al cargar los cursos: ${error.message}`;
      console.error(error);
    } finally {
      this.loading = false;
    }
  },
  
  methods: {
    initializeFilters() {
      // Extraer códigos de materia únicos (DPTO + NÚMERO)
      this.subjectCodes = [...new Set(this.subjects.map(subject => subject.subject))].sort();
    },
    
    applyFilters() {
      this.filteredSubjects = this.subjects.filter(subject => {
        // Filtrar por departamento
        if (this.filters.subject && subject.subject !== this.filters.subject) {
          return false;
        }
        
        // Filtrar por texto de búsqueda
        if (this.filters.search) {
          const searchTerm = this.filters.search.toLowerCase();
          const subjectCode = `${subject.subject}${subject.courseNumber}`.toLowerCase();
          const subjectTitle = subject.courseTitle.toLowerCase();
          
          if (!subjectCode.includes(searchTerm) && !subjectTitle.includes(searchTerm)) {
            return false;
          }
        }
        
        return true;
      });
    },
    
    toggleSubjectSelection(subject) {
      const index = this.selectedSubjects.findIndex(s => s.id === subject.id);
      
      if (index === -1) {
        // Si la materia no está seleccionada, agregarla
        this.selectedSubjects.push(subject);
      } else {
        // Si ya está seleccionada, quitarla
        this.selectedSubjects.splice(index, 1);
      }
    },
    
    isSubjectSelected(subjectId) {
      return this.selectedSubjects.some(subject => subject.id === subjectId);
    },
    
    clearFilters() {
      this.filters = {
        subject: '',
        search: ''
      };
      this.applyFilters();
    },
    
    countOpenSections(subject) {
      return subject.sections.filter(section => section.openSection).length;
    },
    
    generateSchedules() {
      this.generatingSchedules = true;
      
      // Pequeño retraso para permitir que la UI se actualice
      setTimeout(() => {
        try {
          this.generatedSchedules = ScheduleGeneratorService.generatePossibleSchedules(
            this.selectedSubjects, 
            this.onlyOpenSections
          );
          
          // Emitir evento con los resultados
          this.$emit('schedules-generated', this.generatedSchedules);
        } catch (error) {
          console.error('Error generando horarios:', error);
          this.error = `Error al generar horarios: ${error.message}`;
        } finally {
          this.generatingSchedules = false;
        }
      }, 100);
    },
    
    // Formateadores para la UI
    formatSubjectSections(subject) {
      const totalSections = subject.sections.length;
      const openSections = this.countOpenSections(subject);
      
      // Obtener los NRCs de las primeras secciones para mostrar
      const nrcs = subject.sections.slice(0, 2)
        .map(section => section.courseReferenceNumber)
        .filter(Boolean)
        .join(", ");
      
      return `${openSections} de ${totalSections} secciones abiertas${nrcs ? ` (NRCs: ${nrcs}${subject.sections.length > 2 ? '...' : ''})` : ''}`;
    }
  },
  
  template: `
    <div>
      <div v-if="loading" class="text-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p class="mt-2">Cargando materias...</p>
      </div>
      
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>
      
      <div v-else>
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h2 class="m-0">Materias Disponibles</h2>
            <span class="badge bg-info">{{ filteredSubjects.length }} materias</span>
          </div>
          
          <div class="card-body">
            <div class="filter-section">
              <div class="row mb-3">
                <div class="col-md-6 mb-2">
                  <label class="form-label">Departamento:</label>
                  <select v-model="filters.subject" class="form-select" @change="applyFilters">
                    <option value="">Todos</option>
                    <option v-for="code in subjectCodes" :key="code" :value="code">
                      {{ code }}
                    </option>
                  </select>
                </div>
                
                <div class="col-md-6 mb-2">
                  <label class="form-label">Buscar:</label>
                  <input 
                    v-model="filters.search" 
                    @input="applyFilters" 
                    type="text" 
                    class="form-control" 
                    placeholder="Buscar por código o nombre de materia..."
                  >
                </div>
              </div>
              
              <div class="row">
                <div class="col-auto">
                  <button @click="clearFilters" class="btn btn-outline-secondary">
                    Limpiar filtros
                  </button>
                </div>
              </div>
            </div>
            
            <div class="subject-list-container">
              <div v-if="filteredSubjects.length === 0" class="text-center p-4">
                No se encontraron materias con los filtros aplicados.
              </div>
              
              <div 
                v-for="subject in filteredSubjects" 
                :key="subject.id"
                :class="['subject-item p-3 mb-2', isSubjectSelected(subject.id) ? 'selected' : '']"
                @click="toggleSubjectSelection(subject)"
              >
                <div class="d-flex justify-content-between align-items-start">
                  <div style="width: 85%;">
                    <div class="subject-code">{{ subject.subject }}{{ subject.courseNumber }}</div>
                    <div class="subject-title">{{ subject.courseTitle }}</div>
                    <div class="subject-details mt-1">
                      <div>{{ formatSubjectSections(subject) }}</div>
                      <span class="section-badge credits-badge">{{ subject.creditHourLow || 0 }} créditos</span>
                    </div>
                  </div>
                  
                  <div v-if="isSubjectSelected(subject.id)" class="text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16">
                      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h2 class="m-0">Materias Seleccionadas</h2>
          </div>
          
          <div class="card-body">
            <div v-if="selectedSubjects.length === 0" class="text-center p-4">
              <p>No has seleccionado ninguna materia</p>
              <p class="text-muted">Haz clic en las materias para seleccionarlas</p>
            </div>
            
            <div v-else>
              <div v-for="subject in selectedSubjects" :key="subject.id" class="selected-subject-item p-2 mb-2 border rounded">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <div class="subject-code">{{ subject.subject }}{{ subject.courseNumber }}</div>
                    <div class="subject-title small">{{ subject.courseTitle }}</div>
                    <div class="small text-muted">{{ subject.creditHourLow || 0 }} créditos · {{ formatSubjectSections(subject) }}</div>
                  </div>
                  
                  <button @click.stop="toggleSubjectSelection(subject)" class="btn btn-sm btn-outline-danger">
                    &times;
                  </button>
                </div>
              </div>
              
              <div class="d-flex justify-content-between mt-3 p-2 border-top">
                <div>
                  <strong>Total de materias:</strong>
                </div>
                <div>
                  <strong>{{ selectedSubjects.length }}</strong>
                </div>
              </div>
              
              <div class="mt-3">
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" v-model="onlyOpenSections" id="onlyOpenSections">
                  <label class="form-check-label" for="onlyOpenSections">
                    Considerar solo secciones abiertas
                  </label>
                </div>
                
                <button 
                  @click="generateSchedules" 
                  class="btn btn-primary w-100"
                  :disabled="selectedSubjects.length === 0 || generatingSchedules"
                >
                  <span v-if="generatingSchedules" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Generar horarios posibles
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
