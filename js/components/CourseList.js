import CourseService from '../services/CourseService.js';

export default {
  data() {
    return {
      courses: [],
      filteredCourses: [],
      selectedCourses: [],
      loading: true,
      error: null,
      filters: {
        subject: '',
        courseNumber: '',
        search: '',
        onlyOpen: true
      },
      subjects: [],
      courseNumbers: []
    };
  },
  
  async mounted() {
    try {
      this.loading = true;
      this.courses = await CourseService.loadCourses();
      this.filteredCourses = [...this.courses];
      this.initializeFilters();
      this.applyFilters();
      
      // Verificación de acentos - log para depuración
      console.log("Muestra de títulos con acentos:", 
        this.courses.slice(0, 5).map(c => c.courseTitle).join(", "));
    } catch (error) {
      this.error = `Error al cargar los cursos: ${error.message}`;
      console.error(error);
    } finally {
      this.loading = false;
    }
  },
  
  methods: {
    initializeFilters() {
      // Extraer materias únicas
      this.subjects = [...new Set(this.courses.map(course => course.subject))].sort();
      
      // Extraer números de curso únicos
      this.courseNumbers = [...new Set(this.courses.map(course => course.courseNumber))].sort();
    },
    
    applyFilters() {
      this.filteredCourses = this.courses.filter(course => {
        // Filtrar por materia si se ha seleccionado una
        if (this.filters.subject && course.subject !== this.filters.subject) {
          return false;
        }
        
        // Filtrar por número de curso si se ha seleccionado uno
        if (this.filters.courseNumber && course.courseNumber !== this.filters.courseNumber) {
          return false;
        }
        
        // Filtrar por texto de búsqueda
        if (this.filters.search) {
          const searchTerm = this.filters.search.toLowerCase();
          const courseCode = `${course.subject}${course.courseNumber}`.toLowerCase();
          const courseTitle = course.courseTitle.toLowerCase();
          
          if (!courseCode.includes(searchTerm) && !courseTitle.includes(searchTerm)) {
            return false;
          }
        }
        
        // Filtrar por secciones abiertas si se ha marcado esa opción
        if (this.filters.onlyOpen && !course.openSection) {
          return false;
        }
        
        return true;
      });
    },
    
    toggleCourseSelection(course) {
      const index = this.selectedCourses.findIndex(c => c.id === course.id);
      
      if (index === -1) {
        // Si el curso no está seleccionado, agregarlo
        this.selectedCourses.push(course);
      } else {
        // Si ya está seleccionado, quitarlo
        this.selectedCourses.splice(index, 1);
      }
    },
    
    isCourseSelected(courseId) {
      return this.selectedCourses.some(course => course.id === courseId);
    },
    
    clearFilters() {
      this.filters = {
        subject: '',
        courseNumber: '',
        search: '',
        onlyOpen: true
      };
      this.applyFilters();
    },
    
    getMeetingDaysText(meeting) {
      if (!meeting) return '';
      
      const days = [];
      if (meeting.monday) days.push('Lun');
      if (meeting.tuesday) days.push('Mar');
      if (meeting.wednesday) days.push('Mié');
      if (meeting.thursday) days.push('Jue');
      if (meeting.friday) days.push('Vie');
      if (meeting.saturday) days.push('Sáb');
      if (meeting.sunday) days.push('Dom');
      
      return days.join('/');
    },
    
    formatSchedule(course) {
      if (!course.meetingsFaculty || course.meetingsFaculty.length === 0) {
        return 'Sin horario definido';
      }
      
      // Procesamos todas las reuniones en lugar de solo la primera
      const schedules = course.meetingsFaculty
        .filter(meeting => meeting.meetingTime)
        .map(meeting => {
          const mt = meeting.meetingTime;
          const days = this.getMeetingDaysText(mt);
          // Ignoramos las reuniones sin días específicos
          if (!days) return null;
          
          const startTime = this.formatTime(mt.beginTime);
          const endTime = this.formatTime(mt.endTime);
          return `${days} ${startTime}-${endTime}`;
        })
        .filter(Boolean); // Eliminamos valores nulos
      
      if (schedules.length === 0) {
        return 'Sin horario definido';
      }
      
      // Unimos todos los horarios con un separador
      return schedules.join(' | ');
    },
    
    formatTime(timeStr) {
      if (!timeStr) return '';
      
      const hours = parseInt(timeStr.substring(0, 2), 10);
      const minutes = timeStr.substring(2);
      
      return `${hours}:${minutes}`;
    }
  },
  
  computed: {
    totalSelectedCredits() {
      return this.selectedCourses.reduce((total, course) => {
        return total + (parseFloat(course.creditHourLow) || 0);
      }, 0);
    }
  },
  
  template: `
    <div>
      <div v-if="loading" class="text-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p class="mt-2">Cargando cursos...</p>
      </div>
      
      <div v-else-if="error" class="alert alert-danger">
        {{ error }}
      </div>
      
      <div v-else class="row">
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h2 class="m-0">Asignaturas Disponibles</h2>
              <span class="badge bg-info">{{ filteredCourses.length }} encontradas</span>
            </div>
            
            <div class="card-body">
              <div class="filter-section">
                <div class="row mb-3">
                  <div class="col-md-4 mb-2">
                    <label class="form-label">Materia:</label>
                    <select v-model="filters.subject" class="form-select" @change="applyFilters">
                      <option value="">Todas</option>
                      <option v-for="subject in subjects" :key="subject" :value="subject">
                        {{ subject }}
                      </option>
                    </select>
                  </div>
                  
                  <div class="col-md-4 mb-2">
                    <label class="form-label">Número:</label>
                    <select v-model="filters.courseNumber" class="form-select" @change="applyFilters">
                      <option value="">Todos</option>
                      <option v-for="number in courseNumbers" :key="number" :value="number">
                        {{ number }}
                      </option>
                    </select>
                  </div>
                  
                  <div class="col-md-4 mb-2 d-flex align-items-end">
                    <div class="form-check">
                      <input v-model="filters.onlyOpen" class="form-check-input" type="checkbox" id="onlyOpenCheck" @change="applyFilters">
                      <label class="form-check-label" for="onlyOpenCheck">
                        Solo secciones abiertas
                      </label>
                    </div>
                  </div>
                </div>
                
                <div class="row">
                  <div class="col">
                    <input 
                      v-model="filters.search" 
                      @input="applyFilters" 
                      type="text" 
                      class="form-control" 
                      placeholder="Buscar por código o nombre de asignatura..."
                    >
                  </div>
                  
                  <div class="col-auto">
                    <button @click="clearFilters" class="btn btn-outline-secondary">
                      Limpiar filtros
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="course-list-container">
                <div v-if="filteredCourses.length === 0" class="text-center p-4">
                  No se encontraron asignaturas con los filtros aplicados.
                </div>
                
                <div 
                  v-for="course in filteredCourses" 
                  :key="course.id"
                  :class="['course-item p-3 mb-2', isCourseSelected(course.id) ? 'selected' : '']"
                  @click="toggleCourseSelection(course)"
                >
                  <!-- Indicador de fuente de datos -->
                  <div v-if="course.dataSource === 'html'" 
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
                      <div class="course-code">{{ course.subject }}{{ course.courseNumber }}-{{ course.sequenceNumber }}</div>
                      <div class="course-title">{{ course.courseTitle }}</div>
                      <div class="course-details mt-1">
                        <div class="schedules">
                          {{ formatSchedule(course) }}
                        </div>
                        <div class="mt-1">
                          <span class="section-badge" :class="course.openSection ? 'section-open' : 'section-closed'">
                            {{ course.openSection ? 'Abierta' : 'Cerrada' }}
                          </span>
                          <span class="section-badge credits-badge">{{ course.creditHourLow || 0 }} créditos</span>
                          <span class="text-muted small">{{ course.scheduleType }}</span>
                          <span class="section-badge nrc-badge">NRC: {{ course.courseReferenceNumber }}</span>
                          <!-- Mostrar profesor si viene de HTML -->
                          <span v-if="course.dataSource === 'html' && course.professorName" 
                                class="section-badge" 
                                :class="course.professorName === 'Por Asignar' ? 'section-closed' : 'section-open'">
                            {{ course.professorName }}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div v-if="isCourseSelected(course.id)" class="text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col-lg-4">
          <div class="card">
            <div class="card-header">
              <h2 class="m-0">Asignaturas Seleccionadas</h2>
            </div>
            
            <div class="card-body">
              <div v-if="selectedCourses.length === 0" class="text-center p-4">
                <p>No has seleccionado ninguna asignatura</p>
                <p class="text-muted">Haz clic en las asignaturas para seleccionarlas</p>
              </div>
              
              <div v-else>
                <div v-for="course in selectedCourses" :key="course.id" class="selected-course-item p-2 mb-2 border rounded">
                  <div class="d-flex justify-content-between align-items-center">
                    <div>
                      <div class="course-code">{{ course.subject }}{{ course.courseNumber }}-{{ course.sequenceNumber }}</div>
                      <div class="course-title small">{{ course.courseTitle }}</div>
                      <div class="small text-muted">{{ course.creditHourLow || 0 }} créditos | NRC: {{ course.courseReferenceNumber }}</div>
                    </div>
                    
                    <button @click.stop="toggleCourseSelection(course)" class="btn btn-sm btn-outline-danger">
                      &times;
                    </button>
                  </div>
                </div>
                
                <div class="d-flex justify-content-between mt-3 p-2 border-top">
                  <div>
                    <strong>Total de créditos:</strong>
                  </div>
                  <div>
                    <strong>{{ totalSelectedCredits }}</strong>
                  </div>
                </div>
                
                <div class="mt-3">
                  <button class="btn btn-primary w-100">Ver horario</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
