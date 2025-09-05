import CourseService from '../services/CourseService.js';
import ScheduleGeneratorService from '../services/ScheduleGeneratorService.js';
import { decodeHtmlEntities } from '../utils/HtmlUtils.js';

export default {
  data() {
    return {
      courses: [],
      subjects: [],
      filteredSubjects: [],
      selectedSubjects: [], // Ahora cada ítem tendrá una propiedad "selectionType"
      selectionMode: 'priority', // Puede ser 'priority' o 'candidate'
      loading: true,
      error: null,
      filters: {
        subject: '',
        courseNumber: '',
        search: '',
        campus: '' // Nuevo: filtro por campus/sede
      },
      subjectCodes: [],
      campuses: [], // Nuevo: array de campus/sedes disponibles
      onlyOpenSections: true,
      generatingSchedules: false,
      generatedSchedules: null,
      selectedCampus: '' // Nuevo: para almacenar el campus seleccionado para la generación de horarios
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
  
  computed: {
    // Obtener materias prioritarias
    prioritySubjects() {
      return this.selectedSubjects.filter(item => item.selectionType === 'priority');
    },
    
    // Obtener materias candidatas
    candidateSubjects() {
      return this.selectedSubjects.filter(item => item.selectionType === 'candidate');
    }
  },
  
  methods: {
    // Nueva función para normalizar texto (eliminar acentos)
    normalizeText(text) {
      if (!text) return '';
      return text.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Elimina acentos/diacríticos
        .toLowerCase();
    },
    
    initializeFilters() {
      // Extraer códigos de materia únicos (DPTO + NÚMERO)
      this.subjectCodes = [...new Set(this.subjects.map(subject => subject.subject))].sort();
      
      // Nuevo: extraer sedes/campus únicos
      const allCampuses = new Set();
      this.courses.forEach(course => {
        if (course.campusDescription && course.campusDescription.trim()) {
          allCampuses.add(course.campusDescription);
        }
      });
      this.campuses = [...allCampuses].sort();
    },
    
    applyFilters() {
      this.filteredSubjects = this.subjects.filter(subject => {
        // Filtrar por departamento
        if (this.filters.subject && subject.subject !== this.filters.subject) {
          return false;
        }
        
        // Filtrar por texto de búsqueda - Versión mejorada con normalización
        if (this.filters.search) {
          const searchTerm = this.normalizeText(this.filters.search);
          const subjectCode = this.normalizeText(`${subject.subject}${subject.courseNumber}`);
          const subjectTitle = this.normalizeText(subject.courseTitle);
          
          if (!subjectCode.includes(searchTerm) && !subjectTitle.includes(searchTerm)) {
            return false;
          }
        }
        
        // Nuevo: filtrar por campus/sede
        if (this.filters.campus) {
          // Verificamos si esta materia tiene al menos una sección en el campus seleccionado
          const hasCoursesInCampus = this.courses.some(course => 
            course.subject === subject.subject && 
            course.courseNumber === subject.courseNumber &&
            course.campusDescription === this.filters.campus
          );
          
          if (!hasCoursesInCampus) {
            return false;
          }
        }
        
        return true;
      });
    },
    
    // Método actualizado para seleccionar materias con un tipo (priority o candidate)
    toggleSubjectSelection(subject) {
      const index = this.selectedSubjects.findIndex(s => s.subject.id === subject.id);
      
      if (index === -1) {
        // Si la materia no está seleccionada, agregarla con el tipo actual
        this.selectedSubjects.push({
          subject: subject,
          selectionType: this.selectionMode
        });
      } else {
        // Si ya está seleccionada, quitarla
        this.selectedSubjects.splice(index, 1);
      }
    },
    
    // Método para cambiar el tipo de selección de una materia ya seleccionada
    toggleSelectionType(index) {
      if (index >= 0 && index < this.selectedSubjects.length) {
        const currentType = this.selectedSubjects[index].selectionType;
        this.selectedSubjects[index].selectionType = currentType === 'priority' ? 'candidate' : 'priority';
      }
    },
    
    // Modificado para verificar si una materia está seleccionada
    isSubjectSelected(subjectId) {
      return this.selectedSubjects.some(item => item.subject.id === subjectId);
    },
    
    // Obtener el tipo de selección de una materia
    getSelectionType(subjectId) {
      const item = this.selectedSubjects.find(item => item.subject.id === subjectId);
      return item ? item.selectionType : null;
    },
    
    clearFilters() {
      this.filters = {
        subject: '',
        search: '',
        campus: '' // Limpiar también el filtro de campus
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
          // Verificamos si hay materias que no tienen secciones en el campus seleccionado
          if (this.selectedCampus) {
            const subjectsWithoutSectionsInCampus = this.selectedSubjects.filter(item => {
              return !item.subject.sections.some(section => 
                section.campusDescription === this.selectedCampus
              );
            });
            
            if (subjectsWithoutSectionsInCampus.length > 0) {
              console.log(`Materias sin secciones en ${this.selectedCampus}:`, 
                subjectsWithoutSectionsInCampus.map(item => item.subject.id).join(', ')
              );
            }
          }
          
          // Separamos las materias por tipo para pasarlas al generador
          const prioritySubjects = this.selectedSubjects
            .filter(item => item.selectionType === 'priority')
            .map(item => item.subject);
            
          const candidateSubjects = this.selectedSubjects
            .filter(item => item.selectionType === 'candidate')
            .map(item => item.subject);
          
          this.generatedSchedules = ScheduleGeneratorService.generatePossibleSchedulesWithCandidates(
            prioritySubjects,
            candidateSubjects,
            this.onlyOpenSections,
            this.selectedCampus
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
    },
    
    // Verificar si una materia tiene datos HTML
    hasHtmlData(subject) {
      return subject.sections.some(section => section.dataSource === 'html');
    },
    
    // Obtener el nombre del profesor desde datos HTML
    getHtmlProfessor(subject) {
      const htmlSection = subject.sections.find(section => section.dataSource === 'html');
      return htmlSection ? htmlSection.professorName : null;
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
            <div>
              <div class="btn-group btn-group-sm" role="group">
                <button 
                  @click="selectionMode = 'priority'" 
                  :class="['btn', selectionMode === 'priority' ? 'btn-primary' : 'btn-outline-primary']"
                >
                  Modo: Prioritaria
                </button>
                <button 
                  @click="selectionMode = 'candidate'" 
                  :class="['btn', selectionMode === 'candidate' ? 'btn-primary' : 'btn-outline-primary']"
                >
                  Modo: Candidata
                </button>
              </div>
              <span class="badge bg-info ms-2">{{ filteredSubjects.length }} materias</span>
            </div>
          </div>
          
          <div class="card-body">
            <div class="filter-section">
              <div class="row mb-3">
                <div class="col-md-4 mb-2">
                  <label class="form-label">Departamento:</label>
                  <select v-model="filters.subject" class="form-select" @change="applyFilters">
                    <option value="">Todos</option>
                    <option v-for="code in subjectCodes" :key="code" :value="code">
                      {{ code }}
                    </option>
                  </select>
                </div>
                
                <div class="col-md-4 mb-2">
                  <label class="form-label">Sede:</label>
                  <select v-model="filters.campus" class="form-select" @change="applyFilters">
                    <option value="">Todas</option>
                    <option v-for="campus in campuses" :key="campus" :value="campus">
                      {{ campus }}
                    </option>
                  </select>
                </div>
                
                <div class="col-md-4 mb-2">
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
                <div class="col-auto">
                  <div class="d-flex align-items-center">
                    <span class="me-2">Modo de selección:</span>
                    <span class="badge" :class="selectionMode === 'priority' ? 'bg-danger' : 'bg-warning text-dark'">
                      {{ selectionMode === 'priority' ? 'Prioritaria' : 'Candidata' }}
                    </span>
                  </div>
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
                <!-- Indicador de fuente de datos -->
                <div v-if="hasHtmlData(subject)" 
                     class="data-source-indicator data-source-html"
                     title="Datos actualizados desde HTML">
                  HTML
                </div>
                <div v-else 
                     class="data-source-indicator data-source-json"
                     title="Datos desde JSON original">
                  JSON
                </div>
                
                <div class="d-flex justify-content-between align-items-start">
                  <div style="width: 85%;">
                    <div class="subject-code">{{ subject.subject }}{{ subject.courseNumber }}</div>
                    <div class="subject-title">{{ subject.courseTitle }}</div>
                    <div class="subject-details mt-1">
                      <div>{{ formatSubjectSections(subject) }}</div>
                      <span class="section-badge credits-badge">{{ subject.creditHourLow || 0 }} créditos</span>
                      <!-- Mostrar profesor si viene de HTML -->
                      <span v-if="hasHtmlData(subject) && getHtmlProfessor(subject)" 
                            class="section-badge" 
                            :class="getHtmlProfessor(subject) === 'Por Asignar' ? 'section-closed' : 'section-open'">
                        {{ getHtmlProfessor(subject) }}
                      </span>
                    </div>
                  </div>
                  
                  <div v-if="isSubjectSelected(subject.id)" class="text-primary">
                    <span class="badge me-2" :class="getSelectionType(subject.id) === 'priority' ? 'bg-danger' : 'bg-warning text-dark'">
                      {{ getSelectionType(subject.id) === 'priority' ? 'Prioritaria' : 'Candidata' }}
                    </span>
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
              <!-- Sección de materias prioritarias -->
              <div v-if="prioritySubjects.length > 0">
                <h5 class="mb-3 d-flex align-items-center">
                  <span class="badge bg-danger me-2">Prioritarias</span>
                  <span>Materias que deben estar en todos los horarios</span>
                </h5>
                <div v-for="(item, index) in prioritySubjects" :key="'p-'+item.subject.id" 
                    class="selected-subject-item p-2 mb-2 border rounded border-danger">
                  <div class="d-flex justify-content-between align-items-center">
                    <div>
                      <div class="subject-code">{{ item.subject.subject }}{{ item.subject.courseNumber }}</div>
                      <div class="subject-title small">{{ item.subject.courseTitle }}</div>
                      <div class="small text-muted">{{ item.subject.creditHourLow || 0 }} créditos · {{ formatSubjectSections(item.subject) }}</div>
                    </div>
                    
                    <div class="d-flex">
                      <button @click.stop="toggleSelectionType(selectedSubjects.indexOf(item))" 
                          class="btn btn-sm btn-outline-warning me-2" title="Cambiar a candidata">
                        <i class="bi bi-arrow-down"></i> Candidata
                      </button>
                      <button @click.stop="toggleSubjectSelection(item.subject)" 
                          class="btn btn-sm btn-outline-danger">
                        &times;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Sección de materias candidatas -->
              <div v-if="candidateSubjects.length > 0" :class="{'mt-4': prioritySubjects.length > 0}">
                <h5 class="mb-3 d-flex align-items-center">
                  <span class="badge bg-warning text-dark me-2">Candidatas</span>
                  <span>Materias opcionales que pueden incluirse si no generan conflictos</span>
                </h5>
                <div v-for="(item, index) in candidateSubjects" :key="'c-'+item.subject.id"
                    class="selected-subject-item p-2 mb-2 border rounded border-warning">
                  <div class="d-flex justify-content-between align-items-center">
                    <div>
                      <div class="subject-code">{{ item.subject.subject }}{{ item.subject.courseNumber }}</div>
                      <div class="subject-title small">{{ item.subject.courseTitle }}</div>
                      <div class="small text-muted">{{ item.subject.creditHourLow || 0 }} créditos · {{ formatSubjectSections(item.subject) }}</div>
                    </div>
                    
                    <div class="d-flex">
                      <button @click.stop="toggleSelectionType(selectedSubjects.indexOf(item))" 
                          class="btn btn-sm btn-outline-danger me-2" title="Cambiar a prioritaria">
                        <i class="bi bi-arrow-up"></i> Prioritaria
                      </button>
                      <button @click.stop="toggleSubjectSelection(item.subject)" 
                          class="btn btn-sm btn-outline-danger">
                        &times;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="d-flex justify-content-between mt-3 p-2 border-top">
                <div>
                  <strong>Total de materias:</strong>
                </div>
                <div>
                  <strong>{{ selectedSubjects.length }}</strong>
                  <span class="text-muted ms-2">
                    ({{ prioritySubjects.length }} prioritarias, {{ candidateSubjects.length }} candidatas)
                  </span>
                </div>
              </div>
              
              <div class="mt-3">
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" v-model="onlyOpenSections" id="onlyOpenSections">
                  <label class="form-check-label" for="onlyOpenSections">
                    Considerar solo secciones abiertas
                  </label>
                </div>
                
                <div class="mb-3">
                  <label class="form-label">Generar horarios para sede:</label>
                  <select v-model="selectedCampus" class="form-select">
                    <option value="">Todas las sedes</option>
                    <option v-for="campus in campuses" :key="campus" :value="campus">
                      {{ campus }}
                    </option>
                  </select>
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
